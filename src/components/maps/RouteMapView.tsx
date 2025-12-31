import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Route, RouteShop } from '../../types/route';
import { Shop } from '../../types/shop';
import { firestoreService } from '../../services/firebase';
import { COLLECTIONS } from '../../services/firebase/collections';
import { BookerLocation } from '../../types/location';

// Conditional import for react-native-maps
// Use require() to avoid bundling on web
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

// Only require on native platforms
if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    // Handle different export patterns - default export is usually MapView
    MapView = RNMaps.default || RNMaps.MapView || RNMaps;
    Marker = RNMaps.Marker;
    Polyline = RNMaps.Polyline;
    PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
    console.log('[RouteMapView] react-native-maps loaded:', {
      hasMapView: !!MapView,
      hasMarker: !!Marker,
      hasPolyline: !!Polyline,
      hasProvider: !!PROVIDER_GOOGLE,
      platform: Platform.OS,
      exports: Object.keys(RNMaps).slice(0, 10) // First 10 keys
    });
  } catch (e) {
    console.error('[RouteMapView] Failed to load react-native-maps:', e);
  }
} else {
  console.log('[RouteMapView] Skipping react-native-maps on web platform');
}

interface RouteMapViewProps {
  route: Route;
  shops: Shop[];
  onShopPress?: (shop: Shop) => void;
}

// Web fallback component
const WebMapFallback: React.FC<{ routeCoordinates: Array<{ latitude: number; longitude: number }> }> = ({ routeCoordinates }) => {
  return (
    <View style={styles.container}>
      <View style={styles.webFallback}>
        <Ionicons name="map-outline" size={48} color={colors.gray[400]} />
        <Text style={styles.webFallbackText}>Map view is only available on mobile devices</Text>
        {routeCoordinates.length > 0 && (
          <TouchableOpacity 
            style={[styles.navButton, styles.webNavButton]} 
            onPress={() => {
              const firstShop = routeCoordinates[0];
              const url = `https://www.google.com/maps?q=${firstShop.latitude},${firstShop.longitude}`;
              Linking.openURL(url).catch(err => {
                console.error('Failed to open Google Maps:', err);
              });
            }}
          >
            <Ionicons name="navigate" size={20} color={colors.white} />
            <Text style={styles.navButtonText}>Open in Google Maps</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const RouteMapView: React.FC<RouteMapViewProps> = ({ route, shops, onShopPress }) => {
  const isWeb = Platform.OS === 'web';
  const [currentLocation, setCurrentLocation] = useState<BookerLocation | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 31.5497, // Default to Lahore
    longitude: 74.3436,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Load current booker location
  useEffect(() => {
    if (isWeb) return; // Skip on web

    const loadCurrentLocation = async () => {
      try {
        const location = await firestoreService.getDoc<BookerLocation>(
          COLLECTIONS.BOOKER_LOCATIONS,
          route.bookerId
        );
        
        if (location && location.isOnline) {
          setCurrentLocation(location);
          
          // Update map region to include current location
          setMapRegion(prev => ({
            ...prev,
            latitude: location.latitude,
            longitude: location.longitude,
          }));
        }
      } catch (error) {
        console.warn('Failed to load current location:', error);
      }
    };

    loadCurrentLocation();
    
    // Refresh location every 30 seconds
    const interval = setInterval(loadCurrentLocation, 30000);
    return () => clearInterval(interval);
  }, [route.bookerId, isWeb]);

  // Generate route coordinates for navigation link (needed for both web and native)
  const routeCoordinates = route.shops
    .sort((a, b) => a.sequence - b.sequence)
    .map(routeShop => {
      const shop = shops.find(s => s.id === routeShop.shopId);
      if (shop && (shop as any).latitude && (shop as any).longitude) {
        return {
          latitude: (shop as any).latitude,
          longitude: (shop as any).longitude,
        };
      }
      return null;
    })
    .filter((coord): coord is { latitude: number; longitude: number } => coord !== null);

  const openGoogleMaps = () => {
    if (routeCoordinates.length > 0) {
      const firstShop = routeCoordinates[0];
      const url = Platform.select({
        ios: `maps://app?daddr=${firstShop.latitude},${firstShop.longitude}`,
        android: `google.navigation:q=${firstShop.latitude},${firstShop.longitude}`,
      });
      
      if (url) {
        Linking.openURL(url).catch(err => {
          console.error('Failed to open Google Maps:', err);
        });
      }
    }
  };

  // Calculate map bounds to fit all markers (only for native)
  useEffect(() => {
    if (isWeb) return; // Skip on web
    
    const coordinates: Array<{ latitude: number; longitude: number }> = [];
    
    // Add current location if available
    if (currentLocation) {
      coordinates.push({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    }
    
    // Add shop locations (if shops have coordinates)
    route.shops.forEach(routeShop => {
      const shop = shops.find(s => s.id === routeShop.shopId);
      if (shop && (shop as any).latitude && (shop as any).longitude) {
        coordinates.push({
          latitude: (shop as any).latitude,
          longitude: (shop as any).longitude,
        });
      }
    });

    if (coordinates.length > 0) {
      const minLat = Math.min(...coordinates.map(c => c.latitude));
      const maxLat = Math.max(...coordinates.map(c => c.latitude));
      const minLng = Math.min(...coordinates.map(c => c.longitude));
      const maxLng = Math.max(...coordinates.map(c => c.longitude));

      setMapRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01),
      });
    }
  }, [route.shops, shops, currentLocation, isWeb]);

  // Return web fallback if on web
  if (isWeb) {
    return <WebMapFallback routeCoordinates={routeCoordinates} />;
  }
  
  // On native, check if maps module loaded (PROVIDER_GOOGLE is optional, can be undefined)
  if (!MapView || !Marker || !Polyline) {
    console.warn('react-native-maps not fully loaded on native', { 
      MapView: !!MapView, 
      Marker: !!Marker, 
      Polyline: !!Polyline,
      Platform: Platform.OS 
    });
    return <WebMapFallback routeCoordinates={routeCoordinates} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Current location marker */}
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Your Location"
            description="Current position"
            pinColor={colors.primary[500]}
          >
            <View style={styles.currentLocationMarker}>
              <Ionicons name="location" size={24} color={colors.primary[500]} />
            </View>
          </Marker>
        )}

        {/* Shop markers */}
        {route.shops.map((routeShop, index) => {
          const shop = shops.find(s => s.id === routeShop.shopId);
          if (!shop || !(shop as any).latitude || !(shop as any).longitude) return null;

          const isVisited = routeShop.status === 'visited';
          const isSkipped = routeShop.status === 'skipped';

          return (
            <Marker
              key={routeShop.shopId}
              coordinate={{
                latitude: (shop as any).latitude,
                longitude: (shop as any).longitude,
              }}
              title={shop.name}
              description={`Sequence: ${routeShop.sequence} | Status: ${routeShop.status}`}
              onPress={() => onShopPress?.(shop)}
            >
              <View style={[
                styles.shopMarker,
                isVisited && styles.visitedMarker,
                isSkipped && styles.skippedMarker,
              ]}>
                <Text style={styles.markerText}>{routeShop.sequence}</Text>
              </View>
            </Marker>
          );
        })}

        {/* Route polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.secondary[500]}
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* Navigation button */}
      {routeCoordinates.length > 0 && (
        <TouchableOpacity style={styles.navButton} onPress={openGoogleMaps}>
          <Ionicons name="navigate" size={20} color={colors.white} />
          <Text style={styles.navButtonText}>Navigate</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 16,
  },
  map: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    padding: 20,
  },
  webFallbackText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
  },
  currentLocationMarker: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  shopMarker: {
    backgroundColor: colors.secondary[500],
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  visitedMarker: {
    backgroundColor: colors.success,
  },
  skippedMarker: {
    backgroundColor: colors.error,
  },
  markerText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  navButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  webNavButton: {
    position: 'relative',
    marginTop: 20,
  },
  navButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RouteMapView;
