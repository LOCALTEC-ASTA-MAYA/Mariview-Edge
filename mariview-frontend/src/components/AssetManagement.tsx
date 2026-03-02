import { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Search, Battery, Calendar, Clock, Wrench, Plane, Ship, Car, Package, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { Progress } from './ui/progress';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { saveToStorage, loadFromStorage } from '../utils/storage';
import { useQuery } from '@apollo/client';
import { GET_DRONES } from '../graphql/queries';

// UAV Assets
const uavAssets = [
  { id: 'UAV-001', name: 'Pyrhos X V1', type: 'Aerial Quadcopter', battery: 100, status: 'available', flightHours: 245, totalFlights: 89, location: 'Hangar A', serial: 'PXV1-2024-001' },
  { id: 'UAV-002', name: 'Pyrhos X V2', type: 'Aerial Quadcopter', battery: 85, status: 'in-flight', flightHours: 189, totalFlights: 67, location: 'Active Mission', serial: 'PXV2-2024-002' },
  { id: 'UAV-003', name: 'AR-2 Aerial', type: 'Tactical Drone', battery: 95, status: 'available', flightHours: 156, totalFlights: 54, location: 'Hangar B', serial: 'AR2-2024-003' },
  { id: 'UAV-004', name: 'Ephyros Alpha', type: 'High Altitude', battery: 78, status: 'charging', flightHours: 312, totalFlights: 102, location: 'Charging Station', serial: 'EPA-2024-004' },
];

// AUV Assets
const auvAssets = [
  { id: 'AUV-001', name: 'AquaScan Alpha', type: 'Survey AUV', battery: 92, status: 'available', diveHours: 123, totalDives: 34, location: 'Dock A', serial: 'ASA-2024-001', maxDepth: 500 },
  { id: 'AUV-002', name: 'DeepSeeker Pro', type: 'Deep Sea AUV', battery: 78, status: 'maintenance', diveHours: 289, totalDives: 56, location: 'Maintenance Bay', serial: 'DSP-2024-002', maxDepth: 1000 },
  { id: 'AUV-003', name: 'OceanExplorer', type: 'Research AUV', battery: 88, status: 'available', diveHours: 167, totalDives: 42, location: 'Dock B', serial: 'OEX-2024-003', maxDepth: 750 },
];

// Vehicle Assets (Mobil Operasional)
const vehicleAssets = [
  { id: 'VEH-001', name: 'Mobile Command Unit', type: 'Command Vehicle', fuel: 85, status: 'available', mileage: 12500, location: 'Base Garage', plate: 'B 1234 XYZ' },
  { id: 'VEH-002', name: 'Field Support Truck', type: 'Support Vehicle', fuel: 92, status: 'in-use', mileage: 8900, location: 'Tanjung Priok', plate: 'B 5678 ABC' },
  { id: 'VEH-003', name: 'Equipment Transport', type: 'Cargo Van', fuel: 67, status: 'available', mileage: 15300, location: 'Base Garage', plate: 'B 9012 DEF' },
];

// Accessories (Aksesoris Drone)
const accessoryAssets = [
  { id: 'BAT-001', name: 'LiPo Battery 6S', type: 'Battery', quantity: 24, status: 'available', capacity: '22000mAh', voltage: '22.2V', cycles: 45 },
  { id: 'BAT-002', name: 'LiPo Battery 4S', type: 'Battery', quantity: 18, status: 'available', capacity: '16000mAh', voltage: '14.8V', cycles: 67 },
  { id: 'CAM-001', name: 'Gimbal Camera 4K', type: 'Camera', quantity: 6, status: 'available', resolution: '4K 60fps', sensor: 'CMOS' },
  { id: 'PRO-001', name: 'Carbon Fiber Propeller Set', type: 'Propeller', quantity: 32, status: 'available', size: '15 inch', material: 'Carbon Fiber' },
  { id: 'SNS-001', name: 'Thermal Imaging Sensor', type: 'Sensor', quantity: 4, status: 'available', range: '640x512', sensitivity: '50mK' },
  { id: 'CHG-001', name: 'Fast Charger Station', type: 'Charger', quantity: 8, status: 'available', output: '500W', ports: '4 ports' },
];

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available': return '#22c55e';
    case 'in-flight':
    case 'in-use': return '#21A68D';
    case 'maintenance': return '#D4E268';
    case 'charging': return '#3b82f6';
    default: return '#6b7280';
  }
};

const getBatteryColor = (battery: number) => {
  if (battery >= 80) return '#22c55e';
  if (battery >= 50) return '#D4E268';
  return '#ef4444';
};

export default function AssetManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  // GraphQL Fetching
  const { data: droneData } = useQuery(GET_DRONES);

  // State untuk CRUD dengan localStorage
  const [uavList, setUavList] = useState<any[]>(() => loadFromStorage('mariview_assets_uav', uavAssets));
  const [auvList, setAuvList] = useState<any[]>(() => loadFromStorage('mariview_assets_auv', auvAssets));
  const [vehicleList, setVehicleList] = useState<any[]>(() => loadFromStorage('mariview_assets_vehicle', vehicleAssets));
  const [accessoryList, setAccessoryList] = useState<any[]>(() => loadFromStorage('mariview_assets_accessory', accessoryAssets));

  // Sync GraphQL data to local state
  useEffect(() => {
    if (droneData?.drones) {
      const apiUavs = droneData.drones.filter((d: any) => d.type.toLowerCase().includes('aerial') || d.type.toUpperCase() === 'UAV');
      const apiAuvs = droneData.drones.filter((d: any) => d.type.toLowerCase().includes('survey') || d.type.toLowerCase().includes('sea') || d.type.toUpperCase() === 'AUV');

      if (apiUavs.length > 0) {
        setUavList(prev => {
          const merged = [...prev];
          apiUavs.forEach((apiDrone: any) => {
            const index = merged.findIndex(p => p.id === apiDrone.id);
            if (index >= 0) {
              merged[index] = { ...merged[index], ...apiDrone };
            } else {
              merged.push(apiDrone);
            }
          });
          return merged;
        });
      }

      if (apiAuvs.length > 0) {
        setAuvList(prev => {
          const merged = [...prev];
          apiAuvs.forEach((apiDrone: any) => {
            const index = merged.findIndex(p => p.id === apiDrone.id);
            if (index >= 0) {
              merged[index] = { ...merged[index], ...apiDrone };
            } else {
              merged.push(apiDrone);
            }
          });
          return merged;
        });
      }
    }
  }, [droneData]);

  // Auto-save to localStorage whenever lists change
  useEffect(() => {
    saveToStorage('mariview_assets_uav', uavList);
  }, [uavList]);

  useEffect(() => {
    saveToStorage('mariview_assets_auv', auvList);
  }, [auvList]);

  useEffect(() => {
    saveToStorage('mariview_assets_vehicle', vehicleList);
  }, [vehicleList]);

  useEffect(() => {
    saveToStorage('mariview_assets_accessory', accessoryList);
  }, [accessoryList]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('uav');
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [assetForm, setAssetForm] = useState({
    name: '',
    type: '',
    status: 'available',
    battery: 100,
    location: '',
    serial: ''
  });

  // CRUD Functions
  const handleAddAsset = () => {
    const newId = `${currentCategory.toUpperCase()}-${String(Date.now()).slice(-3)}`;
    const newAsset: any = {
      ...assetForm,
      id: `${currentCategory.toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
    };

    // Add category-specific defaults
    if (currentCategory === 'uav') {
      newAsset.flightHours = 0;
      newAsset.totalFlights = 0;
    } else if (currentCategory === 'auv') {
      newAsset.diveHours = 0;
      newAsset.totalDives = 0;
      newAsset.maxDepth = 0;
    } else if (currentCategory === 'vehicles') {
      newAsset.fuel = 100;
      newAsset.mileage = 0;
      newAsset.plate = 'B ' + Math.floor(Math.random() * 9000 + 1000) + ' XYZ';
    } else if (currentCategory === 'accessories') {
      newAsset.quantity = 1;
    }

    if (currentCategory === 'uav') {
      setUavList([...uavList, newAsset]);
    } else if (currentCategory === 'auv') {
      setAuvList([...auvList, newAsset]);
    } else if (currentCategory === 'vehicles') {
      setVehicleList([...vehicleList, newAsset]);
    } else {
      setAccessoryList([...accessoryList, newAsset]);
    }

    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEditAsset = () => {
    if (editingAsset) {
      if (currentCategory === 'uav') {
        setUavList(uavList.map((a: any) => a.id === editingAsset.id ? { ...a, ...assetForm } : a));
      } else if (currentCategory === 'auv') {
        setAuvList(auvList.map((a: any) => a.id === editingAsset.id ? { ...a, ...assetForm } : a));
      } else if (currentCategory === 'vehicles') {
        setVehicleList(vehicleList.map((a: any) => a.id === editingAsset.id ? { ...a, ...assetForm } : a));
      } else {
        setAccessoryList(accessoryList.map((a: any) => a.id === editingAsset.id ? { ...a, ...assetForm } : a));
      }
    }

    setIsEditDialogOpen(false);
    setEditingAsset(null);
    resetForm();
  };

  const handleDeleteAsset = (assetId: string, category: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      if (category === 'uav') {
        setUavList(uavList.filter((a: any) => a.id !== assetId));
      } else if (category === 'auv') {
        setAuvList(auvList.filter((a: any) => a.id !== assetId));
      } else if (category === 'vehicle') {
        setVehicleList(vehicleList.filter((a: any) => a.id !== assetId));
      } else {
        setAccessoryList(accessoryList.filter((a: any) => a.id !== assetId));
      }
    }
  };

  const openEditDialog = (asset: any, category: string) => {
    setEditingAsset(asset);
    setCurrentCategory(category);
    setAssetForm({
      name: asset.name,
      type: asset.type,
      status: asset.status,
      battery: asset.battery || 100,
      location: asset.location,
      serial: asset.serial || ''
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setAssetForm({
      name: '',
      type: '',
      status: 'available',
      battery: 100,
      location: '',
      serial: ''
    });
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-[rgb(255,255,255)]">Asset Management</h1>
        <p className="text-muted-foreground text-sm md:text-base">Comprehensive fleet and equipment tracking</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-card border-[#21A68D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#21A68D]/20 flex items-center justify-center">
              <Plane className="w-5 h-5" style={{ color: '#21A68D' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">UAV</p>
              <p className="text-2xl mt-1">{uavList.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-[#0F4C75]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0F4C75]/20 flex items-center justify-center">
              <Ship className="w-5 h-5" style={{ color: '#0F4C75' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">AUV</p>
              <p className="text-2xl mt-1">{auvList.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-[#D4E268]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#D4E268]/20 flex items-center justify-center">
              <Car className="w-5 h-5" style={{ color: '#D4E268' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vehicles</p>
              <p className="text-2xl mt-1">{vehicleList.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border-[#8b5cf6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#8b5cf6]/20 flex items-center justify-center">
              <Package className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Accessories</p>
              <p className="text-2xl mt-1">{accessoryList.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4 bg-card border-border mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search assets by ID, name, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-input"
          />
        </div>
      </Card>

      {/* Tabs for Asset Categories */}
      <Tabs defaultValue="uav" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="uav" className="data-[state=active]:bg-[#21A68D]">
            <Plane className="w-4 h-4 mr-2" />
            UAV
          </TabsTrigger>
          <TabsTrigger value="auv" className="data-[state=active]:bg-[#0F4C75]">
            <Ship className="w-4 h-4 mr-2" />
            AUV
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="data-[state=active]:bg-[#D4E268]">
            <Car className="w-4 h-4 mr-2" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="accessories" className="data-[state=active]:bg-[#8b5cf6]">
            <Package className="w-4 h-4 mr-2" />
            Accessories
          </TabsTrigger>
        </TabsList>

        {/* UAV Tab */}
        <TabsContent value="uav">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uavList
              .filter((asset: any) =>
                asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((asset: any) => (
                <Card key={asset.id} className="p-5 bg-card border-border hover:border-[#21A68D] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium mb-1">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">{asset.id}</p>
                    </div>
                    <Badge
                      variant="outline"
                      style={{ borderColor: getStatusColor(asset.status), color: getStatusColor(asset.status) }}
                    >
                      {asset.status}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Battery</span>
                        <span style={{ color: getBatteryColor(asset.battery) }}>{asset.battery}%</span>
                      </div>
                      <Progress value={asset.battery} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Flight Hours</p>
                        <p className="font-medium">{asset.flightHours}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Flights</p>
                        <p className="font-medium">{asset.totalFlights}</p>
                      </div>
                    </div>

                    <div className="text-xs">
                      <p className="text-muted-foreground">Location: {asset.location}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedAsset({ ...asset, category: 'uav' })}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEditDialog(asset, 'uav')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => handleDeleteAsset(asset.id, 'uav')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* AUV Tab */}
        <TabsContent value="auv">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auvList
              .filter((asset: any) =>
                asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((asset: any) => (
                <Card key={asset.id} className="p-5 bg-card border-border hover:border-[#0F4C75] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium mb-1">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">{asset.id}</p>
                    </div>
                    <Badge
                      variant="outline"
                      style={{ borderColor: getStatusColor(asset.status), color: getStatusColor(asset.status) }}
                    >
                      {asset.status}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Battery</span>
                        <span style={{ color: getBatteryColor(asset.battery) }}>{asset.battery}%</span>
                      </div>
                      <Progress value={asset.battery} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Dive Hours</p>
                        <p className="font-medium">{asset.diveHours}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Total Dives</p>
                        <p className="font-medium">{asset.totalDives}</p>
                      </div>
                    </div>

                    <div className="text-xs">
                      <p className="text-muted-foreground">Max Depth: {asset.maxDepth}m</p>
                      <p className="text-muted-foreground">Location: {asset.location}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedAsset({ ...asset, category: 'auv' })}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEditDialog(asset, 'auv')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => handleDeleteAsset(asset.id, 'auv')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Vehicles Tab */}
        <TabsContent value="vehicles">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicleList
              .filter((asset: any) =>
                asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((asset: any) => (
                <Card key={asset.id} className="p-5 bg-card border-border hover:border-[#D4E268] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium mb-1">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">{asset.plate}</p>
                    </div>
                    <Badge
                      variant="outline"
                      style={{ borderColor: getStatusColor(asset.status), color: getStatusColor(asset.status) }}
                    >
                      {asset.status}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Fuel Level</span>
                        <span style={{ color: getBatteryColor(asset.fuel) }}>{asset.fuel}%</span>
                      </div>
                      <Progress value={asset.fuel} className="h-2" />
                    </div>

                    <div className="text-sm">
                      <div className="flex justify-between mb-1">
                        <p className="text-muted-foreground text-xs">Mileage</p>
                        <p className="font-medium">{asset.mileage.toLocaleString()} km</p>
                      </div>
                    </div>

                    <div className="text-xs">
                      <p className="text-muted-foreground">Location: {asset.location}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedAsset({ ...asset, category: 'vehicle' })}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEditDialog(asset, 'vehicles')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => handleDeleteAsset(asset.id, 'vehicle')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Accessories Tab */}
        <TabsContent value="accessories">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessoryList
              .filter((asset: any) =>
                asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((asset: any) => (
                <Card key={asset.id} className="p-5 bg-card border-border hover:border-[#8b5cf6] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium mb-1">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">{asset.id}</p>
                    </div>
                    <Badge
                      variant="outline"
                      style={{ borderColor: getStatusColor(asset.status), color: getStatusColor(asset.status) }}
                    >
                      Stock: {asset.quantity}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    {asset.capacity && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span>{asset.capacity}</span>
                      </div>
                    )}
                    {asset.voltage && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Voltage:</span>
                        <span>{asset.voltage}</span>
                      </div>
                    )}
                    {asset.cycles && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Cycles:</span>
                        <span>{asset.cycles}</span>
                      </div>
                    )}
                    {asset.resolution && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolution:</span>
                        <span>{asset.resolution}</span>
                      </div>
                    )}
                    {asset.size && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size:</span>
                        <span>{asset.size}</span>
                      </div>
                    )}
                    {asset.output && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Output:</span>
                        <span>{asset.output}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedAsset({ ...asset, category: 'accessory' })}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEditDialog(asset, 'accessories')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => handleDeleteAsset(asset.id, 'accessory')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <Sheet open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
        <SheetContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedAsset && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span style={{ color: '#21A68D' }}>{selectedAsset.name}</span>
                  <Badge variant="outline" style={{ borderColor: getStatusColor(selectedAsset.status), color: getStatusColor(selectedAsset.status) }}>
                    {selectedAsset.status}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {selectedAsset.type} - {selectedAsset.id}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Specifications */}
                <Card className="p-4 bg-muted/30">
                  <h3 className="text-sm mb-3" style={{ color: '#21A68D' }}>Specifications</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID:</span>
                      <span>{selectedAsset.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span>{selectedAsset.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span>{selectedAsset.type}</span>
                    </div>
                    {selectedAsset.serial && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Serial:</span>
                        <span>{selectedAsset.serial}</span>
                      </div>
                    )}
                    {selectedAsset.plate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plate Number:</span>
                        <span>{selectedAsset.plate}</span>
                      </div>
                    )}
                    {selectedAsset.quantity !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantity:</span>
                        <span>{selectedAsset.quantity} units</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Performance Metrics */}
                {(selectedAsset.battery !== undefined || selectedAsset.fuel !== undefined) && (
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-sm mb-3" style={{ color: '#0F4C75' }}>Performance Metrics</h3>
                    <div className="space-y-4">
                      {selectedAsset.battery !== undefined && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Battery Level</span>
                            <span style={{ color: getBatteryColor(selectedAsset.battery) }}>{selectedAsset.battery}%</span>
                          </div>
                          <Progress value={selectedAsset.battery} className="h-2" />
                        </div>
                      )}
                      {selectedAsset.fuel !== undefined && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Fuel Level</span>
                            <span style={{ color: getBatteryColor(selectedAsset.fuel) }}>{selectedAsset.fuel}%</span>
                          </div>
                          <Progress value={selectedAsset.fuel} className="h-2" />
                        </div>
                      )}
                      {selectedAsset.flightHours !== undefined && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Total Flight Hours</span>
                            <span>{selectedAsset.flightHours}h</span>
                          </div>
                        </div>
                      )}
                      {selectedAsset.diveHours !== undefined && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Total Dive Hours</span>
                            <span>{selectedAsset.diveHours}h</span>
                          </div>
                        </div>
                      )}
                      {selectedAsset.mileage !== undefined && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Mileage</span>
                            <span>{selectedAsset.mileage.toLocaleString()} km</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Additional Info */}
                <Card className="p-4 bg-muted/30">
                  <h3 className="text-sm mb-3">Additional Information</h3>
                  <div className="space-y-2 text-sm">
                    {selectedAsset.maxDepth && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Depth:</span>
                        <span>{selectedAsset.maxDepth}m</span>
                      </div>
                    )}
                    {selectedAsset.capacity && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span>{selectedAsset.capacity}</span>
                      </div>
                    )}
                    {selectedAsset.resolution && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolution:</span>
                        <span>{selectedAsset.resolution}</span>
                      </div>
                    )}
                    {selectedAsset.material && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Material:</span>
                        <span>{selectedAsset.material}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span>{selectedAsset.location}</span>
                    </div>
                  </div>
                </Card>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]">
                    <Wrench className="w-4 h-4 mr-2" />
                    Schedule Service
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Export Report
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Asset Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>
              Add a new asset to the inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                type="text"
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Input
                type="text"
                value={assetForm.type}
                onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })}
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={assetForm.status}
                onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}
              >
                <SelectTrigger className="bg-input">
                  <SelectValue placeholder="Select status">{assetForm.status}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in-flight">In-Flight</SelectItem>
                  <SelectItem value="in-use">In-Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="charging">Charging</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Battery Level</Label>
              <Input
                type="number"
                value={assetForm.battery}
                onChange={(e) => setAssetForm({ ...assetForm, battery: parseInt(e.target.value) })}
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                type="text"
                value={assetForm.location}
                onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input
                type="text"
                value={assetForm.serial}
                onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })}
                className="bg-input"
              />
            </div>
          </div>

          <DialogTrigger className="hidden" />
          <div className="mt-6 flex gap-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setIsAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="w-full bg-[#21A68D] hover:bg-[#1a8a72]"
              onClick={handleAddAsset}
            >
              Add Asset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Edit the asset details.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                type="text"
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Input
                type="text"
                value={assetForm.type}
                onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })}
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={assetForm.status}
                onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}
              >
                <SelectTrigger className="bg-input">
                  <SelectValue placeholder="Select status">{assetForm.status}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in-flight">In-Flight</SelectItem>
                  <SelectItem value="in-use">In-Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="charging">Charging</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Battery Level</Label>
              <Input
                type="number"
                value={assetForm.battery}
                onChange={(e) => setAssetForm({ ...assetForm, battery: parseInt(e.target.value) || 0 })}
                className="bg-input"
                min="0"
                max="100"
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                type="text"
                value={assetForm.location}
                onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                className="bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input
                type="text"
                value={assetForm.serial}
                onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })}
                className="bg-input"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]"
              onClick={handleEditAsset}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
