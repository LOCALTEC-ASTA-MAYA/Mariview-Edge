import { useState, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Search, Battery, Calendar, Clock, Wrench, Plane, Ship, Car, Package, Plus, Edit, Trash2, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { Progress } from './ui/progress';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ASSETS, CREATE_ASSET, UPDATE_ASSET, DELETE_ASSET } from '../graphql/queries';

// ─── Helpers ────────────────────────────────────────────
const getStatusColor = (status: string) => {
  switch ((status || '').toLowerCase()) {
    case 'available':
    case 'standby': return '#22c55e';
    case 'in-flight':
    case 'in_flight':
    case 'active': return '#21A68D';
    case 'in-use':
    case 'in_use': return '#3b82f6';
    case 'maintenance': return '#f59e0b';
    case 'charging': return '#6366f1';
    default: return '#6b7280';
  }
};

const getBatteryColor = (battery: number) => {
  if (battery >= 80) return '#22c55e';
  if (battery >= 50) return '#f59e0b';
  return '#ef4444';
};

const statusLabel = (s: string) => {
  switch ((s || '').toUpperCase()) {
    case 'STANDBY': return 'Standby';
    case 'ACTIVE': return 'Active';
    case 'IN_FLIGHT': return 'In-Flight';
    case 'IN_USE': return 'In-Use';
    case 'MAINTENANCE': return 'Maintenance';
    case 'CHARGING': return 'Charging';
    default: return s;
  }
};

// Type options per category
const typeOptions: Record<string, { value: string; label: string }[]> = {
  UAV: [
    { value: 'Aerial Quadcopter', label: 'Aerial Quadcopter' },
    { value: 'Tactical Drone', label: 'Tactical Drone' },
    { value: 'High Altitude', label: 'High Altitude' },
    { value: 'Fixed Wing', label: 'Fixed Wing' },
    { value: 'Racing Drone', label: 'Racing Drone' },
    { value: 'Hexacopter', label: 'Hexacopter' },
  ],
  AUV: [
    { value: 'Survey AUV', label: 'Survey AUV' },
    { value: 'Deep Sea AUV', label: 'Deep Sea AUV' },
    { value: 'Research AUV', label: 'Research AUV' },
    { value: 'Inspection ROV', label: 'Inspection ROV' },
    { value: 'Mine Countermeasure', label: 'Mine Countermeasure' },
  ],
  VEHICLE: [
    { value: 'Command Vehicle', label: 'Command Vehicle' },
    { value: 'Support Vehicle', label: 'Support Vehicle' },
    { value: 'Cargo Van', label: 'Cargo Van' },
    { value: 'Patrol Vehicle', label: 'Patrol Vehicle' },
    { value: 'Transport Bus', label: 'Transport Bus' },
  ],
  ACCESSORY: [
    { value: 'Battery', label: 'Battery' },
    { value: 'Camera', label: 'Camera' },
    { value: 'Propeller', label: 'Propeller' },
    { value: 'Sensor', label: 'Sensor' },
    { value: 'Charger', label: 'Charger' },
    { value: 'Controller', label: 'Controller' },
    { value: 'Antenna', label: 'Antenna' },
    { value: 'GPS Module', label: 'GPS Module' },
  ],
};

const statusOptions = [
  { value: 'STANDBY', label: 'Standby' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IN_FLIGHT', label: 'In-Flight' },
  { value: 'IN_USE', label: 'In-Use' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'CHARGING', label: 'Charging' },
];

const defaultForm = {
  name: '', type: '', status: 'STANDBY', battery: 100,
  location: '', serial: '', maxDepth: 0, plate: '',
  fuel: 100, mileage: 0, quantity: 1, capacity: '', voltage: '',
};

// ─── Component ──────────────────────────────────────────
export default function AssetManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('uav');

  // GraphQL — fetch ALL assets from database
  const { data, loading, error, refetch } = useQuery(GET_ASSETS, {
    fetchPolicy: 'network-only',
    onError: (err) => console.error('[AssetMgmt] GraphQL error:', err),
  });
  const allAssets: any[] = data?.getAssets || [];

  // Filter by category
  const uavList = useMemo(() => allAssets.filter((a: any) => a.category === 'UAV'), [allAssets]);
  const auvList = useMemo(() => allAssets.filter((a: any) => a.category === 'AUV'), [allAssets]);
  const vehicleList = useMemo(() => allAssets.filter((a: any) => a.category === 'VEHICLE'), [allAssets]);
  const accessoryList = useMemo(() => allAssets.filter((a: any) => a.category === 'ACCESSORY'), [allAssets]);

  // GraphQL Mutations
  const [createAsset, { loading: creating }] = useMutation(CREATE_ASSET, {
    onCompleted: () => refetch(),
    onError: (err) => console.error('[AssetMgmt] Create failed:', err),
  });
  const [updateAsset, { loading: updating }] = useMutation(UPDATE_ASSET, {
    onCompleted: () => refetch(),
    onError: (err) => console.error('[AssetMgmt] Update failed:', err),
  });
  const [deleteAsset] = useMutation(DELETE_ASSET, {
    onCompleted: () => refetch(),
    onError: (err) => console.error('[AssetMgmt] Delete failed:', err),
  });

  const [isAddUavOpen, setIsAddUavOpen] = useState(false);
  const [isAddAuvOpen, setIsAddAuvOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddAccessoryOpen, setIsAddAccessoryOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('UAV');
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [assetForm, setAssetForm] = useState({ ...defaultForm });

  // ─── CRUD ─────────────────────────────────────────────
  const handleAddAsset = async (category: string) => {
    const catMap: Record<string, string> = {
      uav: 'UAV', auv: 'AUV', vehicles: 'VEHICLE', accessories: 'ACCESSORY',
    };
    const cat = catMap[category] || category.toUpperCase();

    const input: any = {
      name: assetForm.name,
      type: assetForm.type,
      category: cat,
      status: assetForm.status || 'STANDBY',
      location: assetForm.location || '',
    };

    if (cat === 'UAV') {
      input.battery = assetForm.battery;
      input.serial = assetForm.serial;
    } else if (cat === 'AUV') {
      input.battery = assetForm.battery;
      input.serial = assetForm.serial;
      input.maxDepth = assetForm.maxDepth;
    } else if (cat === 'VEHICLE') {
      input.fuel = assetForm.fuel;
      input.mileage = assetForm.mileage;
      input.plate = assetForm.plate;
    } else if (cat === 'ACCESSORY') {
      input.quantity = assetForm.quantity;
      input.capacity = assetForm.capacity;
      input.voltage = assetForm.voltage;
    }

    try {
      await createAsset({ variables: { input } });
    } catch (err) {
      console.error('Failed to create asset:', err);
    }

    // Close dialogs
    setIsAddUavOpen(false);
    setIsAddAuvOpen(false);
    setIsAddVehicleOpen(false);
    setIsAddAccessoryOpen(false);
    resetForm();
  };

  const handleEditAsset = async () => {
    if (!editingAsset) return;
    const input: any = {
      id: editingAsset.id,
      name: assetForm.name,
      type: assetForm.type,
      status: assetForm.status,
      battery: assetForm.battery,
      location: assetForm.location,
      serial: assetForm.serial,
      fuel: assetForm.fuel,
      mileage: assetForm.mileage,
      plate: assetForm.plate,
      maxDepth: assetForm.maxDepth,
      quantity: assetForm.quantity,
      capacity: assetForm.capacity,
      voltage: assetForm.voltage,
    };

    try {
      await updateAsset({ variables: { input } });
    } catch (err) {
      console.error('Failed to update asset:', err);
    }

    setIsEditDialogOpen(false);
    setEditingAsset(null);
    resetForm();
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      try {
        await deleteAsset({ variables: { id: assetId } });
      } catch (err) {
        console.error('Failed to delete asset:', err);
      }
    }
  };

  const openEditDialog = (asset: any) => {
    setEditingAsset(asset);
    setCurrentCategory(asset.category || 'UAV');
    setAssetForm({
      name: asset.name || '',
      type: asset.type || '',
      status: asset.status || 'STANDBY',
      battery: asset.battery ?? 100,
      location: asset.location || '',
      serial: asset.serial || '',
      maxDepth: asset.maxDepth ?? 0,
      plate: asset.plate || '',
      fuel: asset.fuel ?? 100,
      mileage: asset.mileage ?? 0,
      quantity: asset.quantity ?? 1,
      capacity: asset.capacity || '',
      voltage: asset.voltage || '',
    });
    setIsEditDialogOpen(true);
  };

  const openAddDialog = (category: string) => {
    const defaults: Record<string, Partial<typeof defaultForm>> = {
      UAV: { type: 'Aerial Quadcopter', battery: 100 },
      AUV: { type: 'Survey AUV', battery: 100, maxDepth: 500 },
      VEHICLE: { type: 'Support Vehicle', fuel: 100 },
      ACCESSORY: { type: 'Battery', quantity: 1 },
    };
    const catMap: Record<string, string> = { uav: 'UAV', auv: 'AUV', vehicles: 'VEHICLE', accessories: 'ACCESSORY' };
    const cat = catMap[category] || category;
    resetForm();
    setAssetForm(f => ({ ...f, ...defaults[cat] }));
    setCurrentCategory(cat);
    if (cat === 'UAV') setIsAddUavOpen(true);
    else if (cat === 'AUV') setIsAddAuvOpen(true);
    else if (cat === 'VEHICLE') setIsAddVehicleOpen(true);
    else setIsAddAccessoryOpen(true);
  };

  const resetForm = () => setAssetForm({ ...defaultForm });

  // Search helper — safe for null values
  const matchesSearch = (asset: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (asset.name || '').toLowerCase().includes(q)
      || (asset.type || '').toLowerCase().includes(q)
      || (asset.serial || '').toLowerCase().includes(q)
      || (asset.id || '').toLowerCase().includes(q);
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl text-[rgb(255,255,255)]">Asset Management</h1>
        <p className="text-muted-foreground text-sm md:text-base">Comprehensive fleet and equipment tracking</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
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

      {/* Search + Add Button */}
      <div className="flex gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search assets..."
            className="pl-10 bg-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {activeTab === 'uav' && (
          <Button className="bg-[#21A68D] hover:bg-[#1a8a72] text-white" onClick={() => openAddDialog('uav')}>
            <Plus className="w-4 h-4 mr-2" /> Add UAV
          </Button>
        )}
        {activeTab === 'auv' && (
          <Button className="bg-[#0F4C75] hover:bg-[#0b3a5a] text-white" onClick={() => openAddDialog('auv')}>
            <Plus className="w-4 h-4 mr-2" /> Add AUV
          </Button>
        )}
        {activeTab === 'vehicles' && (
          <Button style={{ backgroundColor: '#D4E268', color: '#000000' }} className="hover:opacity-90 font-semibold" onClick={() => openAddDialog('vehicles')}>
            <Plus className="w-4 h-4 mr-2" /> Add Vehicle
          </Button>
        )}
        {activeTab === 'accessories' && (
          <Button style={{ backgroundColor: '#8b5cf6', color: '#ffffff' }} className="hover:opacity-90" onClick={() => openAddDialog('accessories')}>
            <Plus className="w-4 h-4 mr-2" /> Add Accessory
          </Button>
        )}
      </div>

      {/* Loading / Error States */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading assets...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-12 gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5" /> Failed to load assets. <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {!loading && !error && (
      <Tabs defaultValue="uav" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-3">
          <TabsTrigger value="uav" className="data-[state=active]:bg-[#21A68D]" onClick={() => setActiveTab('uav')}>
            <Plane className="w-4 h-4 mr-2" />
            UAV ({uavList.length})
          </TabsTrigger>
          <TabsTrigger value="auv" className="data-[state=active]:bg-[#0F4C75]" onClick={() => setActiveTab('auv')}>
            <Ship className="w-4 h-4 mr-2" />
            AUV ({auvList.length})
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="data-[state=active]:bg-[#D4E268]" onClick={() => setActiveTab('vehicles')}>
            <Car className="w-4 h-4 mr-2" />
            Vehicles ({vehicleList.length})
          </TabsTrigger>
          <TabsTrigger value="accessories" className="data-[state=active]:bg-[#8b5cf6]" onClick={() => setActiveTab('accessories')}>
            <Package className="w-4 h-4 mr-2" />
            Accessories ({accessoryList.length})
          </TabsTrigger>
        </TabsList>

        {/* UAV Tab */}
        <TabsContent value="uav">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uavList.filter(matchesSearch).map((asset: any) => (
                <Card key={asset.id} className="p-5 bg-card border-border hover:border-[#21A68D] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium mb-1">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                      {asset.serial && <p className="text-xs text-muted-foreground mt-1">S/N: {asset.serial}</p>}
                    </div>
                    <Badge variant="outline" style={{ borderColor: getStatusColor(asset.status), color: getStatusColor(asset.status) }}>
                      {statusLabel(asset.status)}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Battery</span>
                        <span style={{ color: getBatteryColor(asset.battery || 0) }}>{asset.battery || 0}%</span>
                      </div>
                      <Progress value={asset.battery || 0} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Flight Hours</p>
                        <p className="font-medium">{asset.flightHours || 0}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Total Ops</p>
                        <p className="font-medium">{asset.totalOps || 0}</p>
                      </div>
                    </div>

                    <div className="text-xs">
                      <p className="text-muted-foreground">Location: {asset.location || '—'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button size="icon" variant="outline" className="flex-1" onClick={() => setSelectedAsset(asset)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="flex-1" onClick={() => openEditDialog(asset)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteAsset(asset.id)}>
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
            {auvList.filter(matchesSearch).map((asset: any) => (
                <Card key={asset.id} className="p-5 bg-card border-border hover:border-[#0F4C75] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium mb-1">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                      {asset.serial && <p className="text-xs text-muted-foreground mt-1">S/N: {asset.serial}</p>}
                    </div>
                    <Badge variant="outline" style={{ borderColor: getStatusColor(asset.status), color: getStatusColor(asset.status) }}>
                      {statusLabel(asset.status)}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Battery</span>
                        <span style={{ color: getBatteryColor(asset.battery || 0) }}>{asset.battery || 0}%</span>
                      </div>
                      <Progress value={asset.battery || 0} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Dive Hours</p>
                        <p className="font-medium">{asset.flightHours || 0}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Max Depth</p>
                        <p className="font-medium">{asset.maxDepth || 0}m</p>
                      </div>
                    </div>

                    <div className="text-xs">
                      <p className="text-muted-foreground">Location: {asset.location || '—'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button size="icon" variant="outline" className="flex-1" onClick={() => setSelectedAsset(asset)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="flex-1" onClick={() => openEditDialog(asset)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteAsset(asset.id)}>
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
            {vehicleList.filter(matchesSearch).map((asset: any) => (
                <Card key={asset.id} className="p-5 bg-card border-border hover:border-[#D4E268] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium mb-1">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                      {asset.plate && <p className="text-xs text-muted-foreground mt-1">Plate: {asset.plate}</p>}
                    </div>
                    <Badge variant="outline" style={{ borderColor: getStatusColor(asset.status), color: getStatusColor(asset.status) }}>
                      {statusLabel(asset.status)}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Fuel</span>
                        <span style={{ color: getBatteryColor(asset.fuel || 0) }}>{asset.fuel || 0}%</span>
                      </div>
                      <Progress value={asset.fuel || 0} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Mileage</p>
                        <p className="font-medium">{(asset.mileage || 0).toLocaleString()} km</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Location</p>
                        <p className="font-medium">{asset.location || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button size="icon" variant="outline" className="flex-1" onClick={() => setSelectedAsset(asset)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="flex-1" onClick={() => openEditDialog(asset)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteAsset(asset.id)}>
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
            {accessoryList.filter(matchesSearch).map((asset: any) => (
                <Card key={asset.id} className="p-5 bg-card border-border hover:border-[#8b5cf6] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-medium mb-1">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                    </div>
                    <Badge variant="outline" style={{ borderColor: getStatusColor(asset.status), color: getStatusColor(asset.status) }}>
                      {statusLabel(asset.status)}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Quantity</p>
                        <p className="font-medium text-lg">{asset.quantity || 0} pcs</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Capacity</p>
                        <p className="font-medium">{asset.capacity || '—'}</p>
                      </div>
                    </div>
                    {asset.voltage && (
                      <div className="text-xs">
                        <p className="text-muted-foreground">Voltage / Info: {asset.voltage}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button size="icon" variant="outline" className="flex-1" onClick={() => setSelectedAsset(asset)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="flex-1" onClick={() => openEditDialog(asset)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteAsset(asset.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <SheetContent className="w-full sm:w-[450px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Asset Details</SheetTitle>
            <SheetDescription>View detailed information about this asset.</SheetDescription>
          </SheetHeader>
          {selectedAsset && (
            <div className="mt-6 space-y-4">
              <Card className="p-4 bg-muted/30">
                <h3 className="font-medium text-lg">{selectedAsset.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedAsset.type}</p>
                <Badge variant="outline" className="mt-2" style={{ borderColor: getStatusColor(selectedAsset.status), color: getStatusColor(selectedAsset.status) }}>
                  {statusLabel(selectedAsset.status)}
                </Badge>
              </Card>

              <Card className="p-4 bg-muted/30">
                <h3 className="text-sm mb-3">Details</h3>
                <div className="space-y-2 text-sm">
                  {selectedAsset.serial && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Serial:</span><span>{selectedAsset.serial}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Location:</span><span>{selectedAsset.location || '—'}</span></div>
                  {selectedAsset.battery != null && selectedAsset.category !== 'VEHICLE' && selectedAsset.category !== 'ACCESSORY' && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Battery:</span><span>{selectedAsset.battery}%</span></div>
                  )}
                  {selectedAsset.flightHours != null && selectedAsset.flightHours > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">{selectedAsset.category === 'AUV' ? 'Dive Hours' : 'Flight Hours'}:</span><span>{selectedAsset.flightHours}h</span></div>
                  )}
                  {selectedAsset.totalOps != null && selectedAsset.totalOps > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Operations:</span><span>{selectedAsset.totalOps}</span></div>
                  )}
                  {selectedAsset.maxDepth != null && selectedAsset.maxDepth > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Max Depth:</span><span>{selectedAsset.maxDepth}m</span></div>
                  )}
                  {selectedAsset.plate && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Plate:</span><span>{selectedAsset.plate}</span></div>
                  )}
                  {selectedAsset.fuel != null && selectedAsset.category === 'VEHICLE' && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Fuel:</span><span>{selectedAsset.fuel}%</span></div>
                  )}
                  {selectedAsset.mileage != null && selectedAsset.mileage > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Mileage:</span><span>{selectedAsset.mileage.toLocaleString()} km</span></div>
                  )}
                  {selectedAsset.quantity != null && selectedAsset.category === 'ACCESSORY' && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Quantity:</span><span>{selectedAsset.quantity} pcs</span></div>
                  )}
                  {selectedAsset.capacity && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Capacity:</span><span>{selectedAsset.capacity}</span></div>
                  )}
                  {selectedAsset.voltage && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Voltage / Info:</span><span>{selectedAsset.voltage}</span></div>
                  )}
                </div>
              </Card>

              <div className="flex gap-3">
                <Button className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]" onClick={() => { openEditDialog(selectedAsset); setSelectedAsset(null); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Asset
                </Button>
                <Button variant="outline" className="flex-1">
                  Export Report
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Add UAV Dialog ─── */}
      <Dialog open={isAddUavOpen} onOpenChange={setIsAddUavOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh] bg-[#1a1a2e] border-[#2a2a3e] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5" style={{ color: '#21A68D' }} />
              <span style={{ color: '#21A68D' }}>Add New UAV</span>
            </DialogTitle>
            <DialogDescription>Add a new UAV drone to the fleet.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. Pyrhos X V3" />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                  {typeOptions.UAV.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input type="text" value={assetForm.serial} onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. PXV3-2024-005" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Battery Level (%)</Label>
                <Input type="number" value={assetForm.battery} onChange={(e) => setAssetForm({ ...assetForm, battery: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                  <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                    {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. Hangar A" />
            </div>
          </div>
          <DialogTrigger className="hidden" />
          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddUavOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]" disabled={!assetForm.name || !assetForm.type || creating} onClick={() => handleAddAsset('uav')}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Add UAV
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add AUV Dialog ─── */}
      <Dialog open={isAddAuvOpen} onOpenChange={setIsAddAuvOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh] bg-[#1a1a2e] border-[#2a2a3e] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="w-5 h-5" style={{ color: '#0F4C75' }} />
              <span style={{ color: '#0F4C75' }}>Add New AUV</span>
            </DialogTitle>
            <DialogDescription>Add a new AUV to the fleet.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. DeepSeeker V2" />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                  {typeOptions.AUV.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input type="text" value={assetForm.serial} onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. DSV2-2024-004" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Battery Level (%)</Label>
                <Input type="number" value={assetForm.battery} onChange={(e) => setAssetForm({ ...assetForm, battery: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Max Depth (m)</Label>
                <Input type="number" value={assetForm.maxDepth} onChange={(e) => setAssetForm({ ...assetForm, maxDepth: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                  <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                    {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. Dock A" />
              </div>
            </div>
          </div>
          <DialogTrigger className="hidden" />
          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddAuvOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#0F4C75] hover:bg-[#0b3a5a]" disabled={!assetForm.name || !assetForm.type || creating} onClick={() => handleAddAsset('auv')}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Add AUV
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Vehicle Dialog ─── */}
      <Dialog open={isAddVehicleOpen} onOpenChange={setIsAddVehicleOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh] bg-[#1a1a2e] border-[#2a2a3e] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" style={{ color: '#D4E268' }} />
              <span style={{ color: '#D4E268' }}>Add New Vehicle</span>
            </DialogTitle>
            <DialogDescription>Add a new operational vehicle.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. Mobile Command Unit" />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                  {typeOptions.VEHICLE.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plate Number</Label>
              <Input type="text" value={assetForm.plate} onChange={(e) => setAssetForm({ ...assetForm, plate: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. B 1234 XYZ" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fuel Level (%)</Label>
                <Input type="number" value={assetForm.fuel} onChange={(e) => setAssetForm({ ...assetForm, fuel: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Mileage (km)</Label>
                <Input type="number" value={assetForm.mileage} onChange={(e) => setAssetForm({ ...assetForm, mileage: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                  <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                    {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. Base Garage" />
              </div>
            </div>
          </div>
          <DialogTrigger className="hidden" />
          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddVehicleOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#D4E268] hover:bg-[#c2d050] text-black" disabled={!assetForm.name || !assetForm.type || creating} onClick={() => handleAddAsset('vehicles')}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Add Vehicle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Accessory Dialog ─── */}
      <Dialog open={isAddAccessoryOpen} onOpenChange={setIsAddAccessoryOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh] bg-[#1a1a2e] border-[#2a2a3e] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" style={{ color: '#8b5cf6' }} />
              <span style={{ color: '#8b5cf6' }}>Add New Accessory</span>
            </DialogTitle>
            <DialogDescription>Add a new accessory or equipment.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. LiPo Battery 6S" />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                  {typeOptions.ACCESSORY.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={assetForm.quantity} onChange={(e) => setAssetForm({ ...assetForm, quantity: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                  <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                    {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="text" value={assetForm.capacity} onChange={(e) => setAssetForm({ ...assetForm, capacity: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. 22000mAh" />
              </div>
              <div className="space-y-2">
                <Label>Voltage / Info</Label>
                <Input type="text" value={assetForm.voltage} onChange={(e) => setAssetForm({ ...assetForm, voltage: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" placeholder="e.g. 22.2V" />
              </div>
            </div>
          </div>
          <DialogTrigger className="hidden" />
          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddAccessoryOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed]" disabled={!assetForm.name || !assetForm.type || creating} onClick={() => handleAddAsset('accessories')}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Add Accessory
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Asset Dialog ─── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh] bg-[#1a1a2e] border-[#2a2a3e] text-white">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>Edit the asset details.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue placeholder="Select type">{assetForm.type}</SelectValue></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                  {(typeOptions[currentCategory] || typeOptions.UAV).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                <SelectTrigger className="bg-[#0f0f1e] border-[#2a2a3e] text-white"><SelectValue placeholder="Select status">{statusLabel(assetForm.status)}</SelectValue></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-[#2a2a3e] text-white">
                  {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Category-specific fields */}
            {(currentCategory === 'UAV' || currentCategory === 'AUV') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Battery Level</Label>
                    <Input type="number" value={assetForm.battery} onChange={(e) => setAssetForm({ ...assetForm, battery: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" max="100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Serial Number</Label>
                    <Input type="text" value={assetForm.serial} onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" />
                  </div>
                </div>
                {currentCategory === 'AUV' && (
                  <div className="space-y-2">
                    <Label>Max Depth (m)</Label>
                    <Input type="number" value={assetForm.maxDepth} onChange={(e) => setAssetForm({ ...assetForm, maxDepth: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" />
                  </div>
                )}
              </>
            )}

            {currentCategory === 'VEHICLE' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fuel Level (%)</Label>
                  <Input type="number" value={assetForm.fuel} onChange={(e) => setAssetForm({ ...assetForm, fuel: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" max="100" />
                </div>
                <div className="space-y-2">
                  <Label>Plate Number</Label>
                  <Input type="text" value={assetForm.plate} onChange={(e) => setAssetForm({ ...assetForm, plate: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" />
                </div>
                <div className="space-y-2">
                  <Label>Mileage (km)</Label>
                  <Input type="number" value={assetForm.mileage} onChange={(e) => setAssetForm({ ...assetForm, mileage: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" />
                </div>
              </div>
            )}

            {currentCategory === 'ACCESSORY' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={assetForm.quantity} onChange={(e) => setAssetForm({ ...assetForm, quantity: parseInt(e.target.value) || 0 })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="text" value={assetForm.capacity} onChange={(e) => setAssetForm({ ...assetForm, capacity: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" />
                </div>
                <div className="space-y-2">
                  <Label>Voltage / Info</Label>
                  <Input type="text" value={assetForm.voltage} onChange={(e) => setAssetForm({ ...assetForm, voltage: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Location</Label>
              <Input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="bg-[#0f0f1e] border-[#2a2a3e] text-white" />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]" disabled={updating} onClick={handleEditAsset}>
              {updating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Edit className="w-4 h-4 mr-2" />} Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}