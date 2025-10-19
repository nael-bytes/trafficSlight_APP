import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  MotorDetails: { item: any };
  TripDetails: { item: any };
  AlertDetails: { item: any };
  DestinationDetails: { item: any };
  FuelLogDetails: { item: any };
  FuelCalculator: undefined;
  AddMotorScreen: undefined;
  AddFuelLogScreen: undefined;
  AddDestinationScreen: undefined;
};

type SectionProps = {
  title: string;
  subtitle?: string;
  text?: string;
  data?: any[]; // Optional, will fallback to []
  navTarget: keyof RootStackParamList;
  onAdd?: () => void;
  icon?: string;
};

const getImageForSection = (title: string, item: any) => {
  const desc = item?.reportType || '';
  switch (title) {
    case 'My Motors':
      return require('../../assets/icons/motor-silhouette.png');
    case 'My Trips':
      return require('../../assets/icons/Trips.png');
    case 'Traffic Reports':
      switch (desc) {
        case 'Accident':
          return require('../../assets/icons/ROAD INCIDENTS ICON/Hazard.png');
        default:
          return require('../../assets/icons/Reports.png');
      }
    case 'Saved Destinations':
      return require('../../assets/icons/checkered-flag.jpg');
    case 'Fuel Logs':
      return require('../../assets/icons/gas_station-71.png');
    default:
      return require('../../assets/icons/default.png');
  }
};

const Section: React.FC<SectionProps> = ({
  title,
  subtitle,
  text,
  data = [],
  navTarget,
  onAdd,
  icon,
}) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const renderItemLabel = (item: any) => {
    switch (title) {
      case 'My Motors':
        return {
          title: item.nickname || item.motorcycleData?.name || 'Motor',
          subtext: item.plateNumber || 'No plate',
          extra: item.motorcycleData?.engineDisplacement
            ? `${item.motorcycleData.engineDisplacement}cc`
            : '',
        };
      case 'My Trips':
        return {
          title: item.origin ? `${item.origin} → ${item.destination}` : 'Trip',
          subtext: `Distance: ${(item.distance || 0).toFixed(1)} km`,
          extra: `ETA: ${item.eta || 'N/A'}`,
        };
      case 'Traffic Reports':
        return {
          title: item.reportType || 'Alert',
          subtext: item.description || '',
          extra: item.status || '',
        };
      case 'Saved Destinations':
        return {
          title: item.label || item.address || 'Destination',
          subtext: item.category || '',
          extra: item.address || '',
        };
      case 'Fuel Logs':
        return {
          title: `₱${item.totalCost?.toFixed(2)} • ${item.liters?.toFixed(1)}L`,
          subtext: `₱/L: ${item.pricePerLiter?.toFixed(2) || 'N/A'}`,
          extra: item.date ? new Date(item.date).toLocaleDateString() : '',
        };
      default:
        return {
          title: 'View',
          subtext: '',
          extra: '',
        };
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {icon && <Ionicons name={icon as any} size={20} />} {title}
        </Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {text && <Text style={styles.subtitle}>{text}</Text>}

        <View style={styles.headerActions}>
          {data.length > 5 && (
            <TouchableOpacity onPress={() => navigation.navigate(navTarget, { fullList: data })}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          )}
          {onAdd && (
            <TouchableOpacity onPress={onAdd}>
              <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {data.length === 0 ? (
        <Text style={styles.emptyText}>No {title.toLowerCase()} yet.</Text>
      ) : (
        <FlatList
          horizontal
          data={data.slice(0, 5)}
          keyExtractor={(item, index) => item._id || index.toString()}
          renderItem={({ item }) => {
            const label = renderItemLabel(item);
            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => navigation.navigate(navTarget, { item })}
              >
                <Image
                  source={getImageForSection(title, item)}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
                <View style={styles.itemLabelContainer}>
                  <Text style={styles.itemTitle}>{label.title}</Text>
                  {label.subtext ? <Text style={styles.itemSubtext}>{label.subtext}</Text> : null}
                  {label.extra ? <Text style={styles.itemExtra}>{label.extra}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          }}
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default Section;

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: 'gray',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  seeAll: {
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: 'gray',
    fontStyle: 'italic',
    marginTop: 5,
  },
  item: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    marginRight: 10,
    width: 150,
    alignItems: 'center',
    height: 170,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#ccc',
  },
  itemLabelContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  itemSubtext: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
  },
  itemExtra: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
});
