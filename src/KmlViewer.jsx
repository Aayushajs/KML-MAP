import React, { useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { kml } from '@tmcw/togeojson'; // Library to convert KML to GeoJSON
import { length, bbox } from '@turf/turf'; // GIS utilities for calculating lengths and bounding boxes
import 'leaflet/dist/leaflet.css'; // Base styles for Leaflet
import './index.css'; // Custom CSS for styling

// Fix for Leaflet marker icons (required due to Webpack issues in some setups)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to automatically fit the map bounds to the GeoJSON data
function FitBounds({ geojson }) {
  const map = useMap(); // Get reference to the Leaflet map instance

  // Calculate and set the map bounds when GeoJSON data is available
  if (geojson?.features?.length > 0) {
    const [minX, minY, maxX, maxY] = bbox(geojson); // Get the bounding box of the GeoJSON data
    map.fitBounds([[minY, minX], [maxY, maxX]]); // Fit the map to the bounding box
  }
  return null; // This component doesn't render anything
}

// Main KML Viewer component
const KmlViewer = () => {
  // State management
  const [geojsonData, setGeojsonData] = useState(null); // Stores the parsed GeoJSON data
  const [elementCounts, setElementCounts] = useState({}); // Counts of different element types in the KML
  const [lineLengths, setLineLengths] = useState({}); // Length calculations for line features
  const [activeView, setActiveView] = useState(null); // Controls which info panel is visible (summary or details)
  const [isLoading, setIsLoading] = useState(false); // Loading state for file parsing
  const mapRef = useRef(); // Reference to the Leaflet map container

  // Function to parse KML file content into GeoJSON and calculate metrics
  const parseKML = (kmlText) => {
    try {
      setIsLoading(true); // Set loading state to true
      // Convert KML text to GeoJSON
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const converted = kml(kmlDoc); // Convert KML to GeoJSON

      const counts = {}; // Object to store counts of each element type
      const lengths = {}; // Object to store lengths of line features

      // Process each feature in the GeoJSON
      converted.features.forEach(feature => {
        const type = feature.geometry?.type; // Get the geometry type of the feature
        if (!type) return;

        // Update the count for the current element type
        counts[type] = (counts[type] || 0) + 1;

        // Calculate lengths for linear features (LineString or MultiLineString)
        if (['LineString', 'MultiLineString'].includes(type)) {
          try {
            const featureLength = length(feature, { units: 'kilometers' }); // Calculate the length of the feature
            lengths[type] = (lengths[type] || 0) + featureLength; // Accumulate the length for the type
          } catch (e) {
            console.error('Error calculating length for feature:', e);
          }
        }
      });

      // Update state with the parsed data and calculations
      setGeojsonData(converted);
      setElementCounts(counts);
      setLineLengths(lengths);
    } catch (error) {
      alert('Error parsing KML file: ' + error.message);
    } finally {
      setIsLoading(false); // Set loading state to false
    }
  };

  // Handle file upload event
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Read the file content and parse it when loaded
    const reader = new FileReader();
    reader.onload = (e) => parseKML(e.target.result); // Parse the KML content
    reader.onerror = () => alert('Error reading file');
    reader.readAsText(file);
  };

  // Handle drag-and-drop file upload
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Read the file content and parse it when loaded
    const reader = new FileReader();
    reader.onload = (e) => parseKML(e.target.result); // Parse the KML content
    reader.onerror = () => alert('Error reading file');
    reader.readAsText(file);
  };

  // Handle drag over event
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Clear all data and reset the map
  const clearData = () => {
    setGeojsonData(null);
    setElementCounts({});
    setLineLengths({});
    setActiveView(null);
  };

  // Component render structure
  return (
    <div style={{ padding: 20, height: '100vh' }}>
      {/* Drag-and-drop file upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '2px dashed #ccc',
          padding: 20,
          textAlign: 'center',
          marginBottom: 20,
          backgroundColor: '#f9f9f9',
        }}
      >
        <p>Drag and drop a KML file here, or click below to upload.</p>
        <input
          type="file"
          accept=".kml"
          onChange={handleFileUpload}
          style={{ marginBottom: 20 }}
        />
      </div>

      {/* Loading spinner */}
      {isLoading && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="spinner"></div>
          <p>Loading KML file...</p>
        </div>
      )}

      {/* View control buttons */}
      <div style={{ marginBottom: 20, gap: 10, display: 'flex' }}>
        <button
          onClick={() => setActiveView('summary')}
          disabled={!geojsonData}
          style={{
            padding: 10,
            backgroundColor: activeView === 'summary' ? '#45a049' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          Show Summary
        </button>
        <button
          onClick={() => setActiveView('details')}
          disabled={!geojsonData}
          style={{
            padding: 10,
            backgroundColor: activeView === 'details' ? '#1976D2' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          Show Details
        </button>
        <button
          onClick={clearData}
          disabled={!geojsonData}
          style={{
            padding: 10,
            backgroundColor: '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          Clear Data
        </button>
      </div>

      {/* Summary view - displays counts of different element types */}
      {activeView === 'summary' && (
        <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ddd', borderRadius: 5 }}>
          <h3>Element Summary</h3>
          {Object.keys(elementCounts).length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Element Type</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(elementCounts).map(([type, count]) => (
                  <tr key={type}>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>{type}</td>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No elements found in KML file</p>
          )}
        </div>
      )}

      {/* Details view - displays lengths of line features */}
      {activeView === 'details' && (
        <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ddd', borderRadius: 5 }}>
          <h3>Line Details</h3>
          {Object.keys(lineLengths).length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Line Type</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Total Length (km)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(lineLengths).map(([type, len]) => (
                  <tr key={type}>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>{type}</td>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>{len.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No line elements found in KML file</p>
          )}
        </div>
      )}

      {/* Leaflet map container */}
      <div style={{ height: '60%', width: '100%' }}>
        <MapContainer
          center={[0, 0]}
          zoom={2}
          ref={mapRef}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geojsonData && (
            <>
              {/* Render GeoJSON data on the map */}
              <GeoJSON
                data={geojsonData}
                style={() => ({
                  color: '#ff0000',
                  weight: 2,
                  opacity: 0.8,
                })}
                onEachFeature={(feature, layer) => {
                  // Add popups to each feature
                  if (feature.properties && feature.properties.name) {
                    layer.bindPopup(feature.properties.name);
                  }
                }}
              />
              {/* Automatically adjust map bounds to fit the GeoJSON data */}
              <FitBounds geojson={geojsonData} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default KmlViewer;