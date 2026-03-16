import { useState, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Search, Battery, Calendar, Clock, Wrench, Plane, Ship, Car, Package, Plus, Edit, Trash2, Eye, Loader2 } from 'lucide-react';
import { Progress } from './ui/progress';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ASSETS, CREATE_ASSET, UPDATE_ASSET, DELETE_ASSET } from '../graphql/queries';

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available':
    case 'standby': return '#22c55e';
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
  const [activeTab, setActiveTab] = useState('uav');

  // GraphQL: fetch ALL assets from database
  const { data, loading, refetch } = useQuery(GET_ASSETS);
  const allAssets: any[] = data?.getAssets || [];

  // Filter by category
  const uavList = useMemo(() => allAssets.filter((a: any) => a.category === 'UAV'), [allAssets]);
  const auvList = useMemo(() => allAssets.filter((a: any) => a.category === 'AUV'), [allAssets]);
  const vehicleList = useMemo(() => allAssets.filter((a: any) => a.category === 'VEHICLE'), [allAssets]);
  const accessoryList = useMemo(() => allAssets.filter((a: any) => a.category === 'ACCESSORY'), [allAssets]);

  // GraphQL Mutations
  const [createAsset] = useMutation(CREATE_ASSET, { onCompleted: () => refetch() });
  const [updateAsset] = useMutation(UPDATE_ASSET, { onCompleted: () => refetch() });
  const [deleteAsset] = useMutation(DELETE_ASSET, { onCompleted: () => refetch() });

  const [isAddUavOpen, setIsAddUavOpen] = useState(false);
  const [isAddAuvOpen, setIsAddAuvOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddAccessoryOpen, setIsAddAccessoryOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('uav');
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [assetForm, setAssetForm] = useState({
    name: '',
    type: '',
    status: 'available',
    battery: 100,
    location: '',
    serial: '',
    maxDepth: 0,
    plate: '',
    fuel: 100,
    mileage: 0,
    quantity: 1,
    capacity: '',
    voltage: '',
  });

  // CRUD Functions — all go to database via GraphQL
  const handleAddAsset = async (category: string) => {
    const catMap: Record<string, string> = {
      uav: 'UAV', auv: 'AUV', vehicles: 'VEHICLE', accessories: 'ACCESSORY',
    };

    const input: any = {
      name: assetForm.name,
      type: assetForm.type,
      category: catMap[category] || category.toUpperCase(),
      status: assetForm.status || 'STANDBY',
      location: assetForm.location,
    };

    if (category === 'uav') {
      input.battery = assetForm.battery;
      input.serial = assetForm.serial;
      setIsAddUavOpen(false);
    } else if (category === 'auv') {
      input.battery = assetForm.battery;
      input.serial = assetForm.serial;
      input.maxDepth = assetForm.maxDepth;
      setIsAddAuvOpen(false);
    } else if (category === 'vehicles') {
      input.fuel = assetForm.fuel;
      input.mileage = assetForm.mileage;
      input.plate = assetForm.plate;
      setIsAddVehicleOpen(false);
    } else if (category === 'accessories') {
      input.quantity = assetForm.quantity;
      input.capacity = assetForm.capacity;
      input.voltage = assetForm.voltage;
      setIsAddAccessoryOpen(false);
    }

    try {
      await createAsset({ variables: { input } });
    } catch (err) {
      console.error('Failed to create asset:', err);
    }
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

  const handleDeleteAsset = async (assetId: string, _category: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      try {
        await deleteAsset({ variables: { id: assetId } });
      } catch (err) {
        console.error('Failed to delete asset:', err);
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
      serial: asset.serial || '',
      maxDepth: asset.maxDepth || 0,
      plate: asset.plate || '',
      fuel: asset.fuel || 100,
      mileage: asset.mileage || 0,
      quantity: asset.quantity || 1,
      capacity: asset.capacity || '',
      voltage: asset.voltage || '',
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
      serial: '',
      maxDepth: 0,
      plate: '',
      fuel: 100,
      mileage: 0,
      quantity: 1,
      capacity: '',
      voltage: '',
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

      {/* Tabs for Asset Categories */}
      <div className="flex justify-end mb-2">
        {activeTab === 'uav' && (
          <Button className="bg-[#21A68D] hover:bg-[#1a8a72] text-white" onClick={() => { setCurrentCategory('uav'); resetForm(); setIsAddUavOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add UAV
          </Button>
        )}
        {activeTab === 'auv' && (
          <Button className="bg-[#0F4C75] hover:bg-[#0b3a5a] text-white" onClick={() => { setCurrentCategory('auv'); resetForm(); setIsAddAuvOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add AUV
          </Button>
        )}
        {activeTab === 'vehicles' && (
          <Button style={{ backgroundColor: '#D4E268', color: '#000000' }} className="hover:opacity-90 font-semibold" onClick={() => { setCurrentCategory('vehicles'); resetForm(); setIsAddVehicleOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Vehicle
          </Button>
        )}
        {activeTab === 'accessories' && (
          <Button style={{ backgroundColor: '#8b5cf6', color: '#ffffff' }} className="hover:opacity-90" onClick={() => { setCurrentCategory('accessories'); resetForm(); setIsAddAccessoryOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Accessory
          </Button>
        )}
      </div>
      <Tabs defaultValue="uav" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-3">
          <TabsTrigger value="uav" className="data-[state=active]:bg-[#21A68D]" onClick={() => setActiveTab('uav')}>
            <Plane className="w-4 h-4 mr-2" />
            UAV
          </TabsTrigger>
          <TabsTrigger value="auv" className="data-[state=active]:bg-[#0F4C75]" onClick={() => setActiveTab('auv')}>
            <Ship className="w-4 h-4 mr-2" />
            AUV
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="data-[state=active]:bg-[#D4E268]" onClick={() => setActiveTab('vehicles')}>
            <Car className="w-4 h-4 mr-2" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="accessories" className="data-[state=active]:bg-[#8b5cf6]" onClick={() => setActiveTab('accessories')}>
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
                        <p className="font-medium">{asset.totalOps || 0}</p>
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
                        <p className="font-medium">{asset.flightHours || 0}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Total Dives</p>
                        <p className="font-medium">{asset.totalOps || 0}</p>
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

      {/* Add UAV Dialog */}
      <Dialog open={isAddUavOpen} onOpenChange={setIsAddUavOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5" style={{ color: '#21A68D' }} />
              <span style={{ color: '#21A68D' }}>Add New UAV</span>
            </DialogTitle>
            <DialogDescription>Add a new UAV drone to the fleet.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-input" placeholder="e.g. Pyrhos X V3" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aerial Quadcopter">Aerial Quadcopter</SelectItem>
                  <SelectItem value="Tactical Drone">Tactical Drone</SelectItem>
                  <SelectItem value="High Altitude">High Altitude</SelectItem>
                  <SelectItem value="Fixed Wing">Fixed Wing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input type="text" value={assetForm.serial} onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })} className="bg-input" placeholder="e.g. PXV3-2024-005" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Battery Level (%)</Label>
                <Input type="number" value={assetForm.battery} onChange={(e) => setAssetForm({ ...assetForm, battery: parseInt(e.target.value) || 0 })} className="bg-input" min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                  <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in-flight">In-Flight</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="charging">Charging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="bg-input" placeholder="e.g. Hangar A" />
            </div>
          </div>
          <DialogTrigger className="hidden" />
          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddUavOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]" onClick={() => handleAddAsset('uav')}>Add UAV</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add AUV Dialog */}
      <Dialog open={isAddAuvOpen} onOpenChange={setIsAddAuvOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="w-5 h-5" style={{ color: '#0F4C75' }} />
              <span style={{ color: '#0F4C75' }}>Add New AUV</span>
            </DialogTitle>
            <DialogDescription>Add a new AUV to the fleet.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-input" placeholder="e.g. DeepSeeker V2" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Survey AUV">Survey AUV</SelectItem>
                  <SelectItem value="Deep Sea AUV">Deep Sea AUV</SelectItem>
                  <SelectItem value="Research AUV">Research AUV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input type="text" value={assetForm.serial} onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })} className="bg-input" placeholder="e.g. DSV2-2024-004" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Battery Level (%)</Label>
                <Input type="number" value={assetForm.battery} onChange={(e) => setAssetForm({ ...assetForm, battery: parseInt(e.target.value) || 0 })} className="bg-input" min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Max Depth (m)</Label>
                <Input type="number" value={assetForm.maxDepth} onChange={(e) => setAssetForm({ ...assetForm, maxDepth: parseInt(e.target.value) || 0 })} className="bg-input" min="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                  <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="charging">Charging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="bg-input" placeholder="e.g. Dock A" />
              </div>
            </div>
          </div>
          <DialogTrigger className="hidden" />
          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddAuvOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#0F4C75] hover:bg-[#0b3a5a]" onClick={() => handleAddAsset('auv')}>Add AUV</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Vehicle Dialog */}
      <Dialog open={isAddVehicleOpen} onOpenChange={setIsAddVehicleOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" style={{ color: '#D4E268' }} />
              <span style={{ color: '#D4E268' }}>Add New Vehicle</span>
            </DialogTitle>
            <DialogDescription>Add a new operational vehicle.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-input" placeholder="e.g. Mobile Command Unit" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Command Vehicle">Command Vehicle</SelectItem>
                  <SelectItem value="Support Vehicle">Support Vehicle</SelectItem>
                  <SelectItem value="Cargo Van">Cargo Van</SelectItem>
                  <SelectItem value="Patrol Vehicle">Patrol Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plate Number</Label>
              <Input type="text" value={assetForm.plate} onChange={(e) => setAssetForm({ ...assetForm, plate: e.target.value })} className="bg-input" placeholder="e.g. B 1234 XYZ" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fuel Level (%)</Label>
                <Input type="number" value={assetForm.fuel} onChange={(e) => setAssetForm({ ...assetForm, fuel: parseInt(e.target.value) || 0 })} className="bg-input" min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Mileage (km)</Label>
                <Input type="number" value={assetForm.mileage} onChange={(e) => setAssetForm({ ...assetForm, mileage: parseInt(e.target.value) || 0 })} className="bg-input" min="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                  <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in-use">In-Use</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input type="text" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="bg-input" placeholder="e.g. Base Garage" />
              </div>
            </div>
          </div>
          <DialogTrigger className="hidden" />
          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddVehicleOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#D4E268] hover:bg-[#c2d050] text-black" onClick={() => handleAddAsset('vehicles')}>Add Vehicle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Accessory Dialog */}
      <Dialog open={isAddAccessoryOpen} onOpenChange={setIsAddAccessoryOpen}>
        <DialogContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" style={{ color: '#8b5cf6' }} />
              <span style={{ color: '#8b5cf6' }}>Add New Accessory</span>
            </DialogTitle>
            <DialogDescription>Add a new accessory or equipment.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input type="text" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="bg-input" placeholder="e.g. LiPo Battery 6S" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={assetForm.type} onValueChange={(value) => setAssetForm({ ...assetForm, type: value })}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Battery">Battery</SelectItem>
                  <SelectItem value="Camera">Camera</SelectItem>
                  <SelectItem value="Propeller">Propeller</SelectItem>
                  <SelectItem value="Sensor">Sensor</SelectItem>
                  <SelectItem value="Charger">Charger</SelectItem>
                  <SelectItem value="Controller">Controller</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={assetForm.quantity} onChange={(e) => setAssetForm({ ...assetForm, quantity: parseInt(e.target.value) || 0 })} className="bg-input" min="0" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                  <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in-use">In-Use</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="text" value={assetForm.capacity} onChange={(e) => setAssetForm({ ...assetForm, capacity: e.target.value })} className="bg-input" placeholder="e.g. 22000mAh" />
              </div>
              <div className="space-y-2">
                <Label>Voltage</Label>
                <Input type="text" value={assetForm.voltage} onChange={(e) => setAssetForm({ ...assetForm, voltage: e.target.value })} className="bg-input" placeholder="e.g. 22.2V" />
              </div>
            </div>
          </div>
          <DialogTrigger className="hidden" />
          <div className="mt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddAccessoryOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed]" onClick={() => handleAddAsset('accessories')}>Add Accessory</Button>
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