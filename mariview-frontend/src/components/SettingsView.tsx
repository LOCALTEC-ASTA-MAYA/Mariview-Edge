import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { User, Settings as SettingsIcon, Brain, Plus, Edit, Trash2, Shield, Save, UserPlus, Palette, RotateCcw, Database, Download, Upload, Trash, ClipboardCheck, ChevronDown, ChevronRight, Camera, Plane, Cloud, Battery, Ship, Anchor, Waves, MapPin, Star, AlertTriangle, Wind, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { useTheme } from '../contexts/ThemeContext';
import { exportAllData, importAllData, clearAllStorage, saveWeatherLocations, loadWeatherLocations, saveDefaultLocation, loadDefaultLocation, WeatherLocation, loadFlightWeatherPolicy, saveFlightWeatherPolicy, FlightWeatherPolicy, defaultFlightWeatherPolicy } from '../utils/storage';

// Mock data
const usersData = [
  { id: 1, name: 'John Commander', email: 'john@droneops.io', role: 'Admin', status: 'active', lastActive: '2025-01-20' },
  { id: 2, name: 'Sarah Pilot', email: 'sarah@droneops.io', role: 'Operator', status: 'active', lastActive: '2025-01-20' },
  { id: 3, name: 'Mike Analyst', email: 'mike@droneops.io', role: 'Analyst', status: 'active', lastActive: '2025-01-19' },
  { id: 4, name: 'Emily Tech', email: 'emily@droneops.io', role: 'Technician', status: 'inactive', lastActive: '2025-01-15' },
];

const vtolPrecheckItems = {
  visualEquipment: {
    label: 'Visual Equipment',
    icon: 'camera',
    items: ['Camera Type', 'Mode Camera', 'Zoom', 'Gimbal Camera', 'Storage', 'Video Transmision'],
  },
  aircraft: {
    label: 'Aircraft',
    icon: 'plane',
    items: ['Wings', 'Wing joiner & locking pin', 'Fuselage', 'Vertical & horizontal stabilizer', 'Landing gear', 'Motor VTOL', 'Motor cruise', 'Propeller', 'ESC', 'Flight Controller', 'IMU & kompas', 'GPS', 'Radio control link', 'Telemetry', 'Servos & linkage', 'Fail-safe RTH', 'Geofence & limit ketinggian'],
  },
  weather: {
    label: 'Weather',
    icon: 'cloud',
    items: ['Weather status', 'Wind Speed', 'Visibility', 'Obstacle'],
  },
  battery: {
    label: 'Battery',
    icon: 'battery',
    items: ['Battery Status', 'Cell', 'Number Battery'],
  },
  engine: {
    label: 'Engine',
    icon: 'engine',
    items: ['Enggine', 'Fuel Capacity'],
  },
};

const quadcopterPrecheckItems = {
  visualEquipment: {
    label: 'Visual Equipment',
    icon: 'camera',
    items: ['Camera Type', 'Mode Camera', 'Zoom', 'Gimbal Camera', 'Storage', 'Video Transmision'],
  },
  aircraft: {
    label: 'Aircraft',
    icon: 'plane',
    items: ['Frame & Arms', 'Landing gear', 'Motor Quadcopter', 'Propeller', 'ESC', 'Flight Controller', 'IMU & kompas', 'GPS', 'Radio control link', 'Telemetry', 'Fail-safe RTH', 'Geofence & limit ketinggian'],
  },
  weather: {
    label: 'Weather',
    icon: 'cloud',
    items: ['Weather status', 'Wind Speed', 'Visibility', 'Obstacle'],
  },
  battery: {
    label: 'Battery',
    icon: 'battery',
    items: ['Battery Status', 'Cell', 'Number Battery'],
  },
  engine: {
    label: 'Engine',
    icon: 'engine',
    items: [],
  },
};

const auvPrecheckItems = {
  visualEquipment: {
    label: 'Sensor & Camera',
    icon: 'camera',
    items: ['Underwater Camera', 'Sonar', 'Depth Sensor', 'Temperature Sensor', 'Video Recording', 'Light / LED'],
  },
  aircraft: {
    label: 'Hull & Vehicle',
    icon: 'ship',
    items: ['Hull Integrity', 'Thruster', 'Propeller', 'Seal & O-ring', 'Ballast System', 'Fin & Rudder', 'Pressure Housing', 'Emergency Buoyancy'],
  },
  weather: {
    label: 'Communication & Navigation',
    icon: 'anchor',
    items: ['Acoustic Modem', 'GPS (Surface)', 'INS / DVL', 'Radio Link', 'Telemetry', 'Fail-safe Surface', 'Depth Limit'],
  },
  battery: {
    label: 'Battery',
    icon: 'battery',
    items: ['Battery Status', 'Cell', 'Number Battery', 'Waterproof Connector'],
  },
  engine: {
    label: 'Sea Conditions',
    icon: 'waves',
    items: ['Sea State', 'Current Speed', 'Visibility Underwater', 'Water Temperature'],
  },
};

const precheckTypes: Record<string, { label: string; icon: string; data: typeof vtolPrecheckItems }> = {
  vtol: { label: 'VTOL', icon: 'plane', data: vtolPrecheckItems },
  quadcopter: { label: 'Quadcopter', icon: 'plane', data: quadcopterPrecheckItems },
  auv: { label: 'AUV', icon: 'ship', data: auvPrecheckItems },
};

const aiModelsData = [
  { id: 1, name: 'Structure Inspection', version: 'v2.4', confidence: 94, status: 'active', lastUpdated: '2025-01-15' },
  { id: 2, name: 'Vehicle Counting', version: 'v3.1', confidence: 92, status: 'active', lastUpdated: '2025-01-18' },
  { id: 3, name: 'People Detection', version: 'v2.8', confidence: 89, status: 'active', lastUpdated: '2025-01-10' },
  { id: 4, name: 'Seabed Mapping', version: 'v1.6', confidence: 91, status: 'active', lastUpdated: '2025-01-12' },
  { id: 5, name: 'Crowd Estimation', version: 'v2.2', confidence: 88, status: 'inactive', lastUpdated: '2025-01-05' },
];

export default function SettingsView() {
  const [users, setUsers] = useState(usersData);
  const [aiModels, setAiModels] = useState(aiModelsData);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const { colors, updateColor, resetColors } = useTheme();

  // Weather Location state
  const [weatherLocations, setWeatherLocations] = useState<WeatherLocation[]>(() => loadWeatherLocations());
  const [defaultLocation, setDefaultLocation] = useState<WeatherLocation>(() => loadDefaultLocation());
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationLat, setNewLocationLat] = useState('');
  const [newLocationLng, setNewLocationLng] = useState('');

  // Flight Weather Policy state
  const [flightPolicy, setFlightPolicy] = useState<FlightWeatherPolicy>(() => loadFlightWeatherPolicy());

  const handleUpdatePolicy = (updates: Partial<FlightWeatherPolicy>) => {
    const updated = { ...flightPolicy, ...updates };
    setFlightPolicy(updated);
    saveFlightWeatherPolicy(updated);
  };

  const handleToggleBlockedWeather = (weatherType: string) => {
    const current = flightPolicy.blockedWeather;
    const updated = current.includes(weatherType)
      ? current.filter(w => w !== weatherType)
      : [...current, weatherType];
    handleUpdatePolicy({ blockedWeather: updated });
  };

  const handleResetPolicy = () => {
    setFlightPolicy(defaultFlightWeatherPolicy);
    saveFlightWeatherPolicy(defaultFlightWeatherPolicy);
    toast.success('Flight weather policy reset to default');
  };

  const handleAddWeatherLocation = () => {
    if (!newLocationName.trim() || !newLocationLat.trim() || !newLocationLng.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    const lat = parseFloat(newLocationLat);
    const lng = parseFloat(newLocationLng);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Latitude and Longitude must be valid numbers');
      return;
    }
    if (lat < -90 || lat > 90) {
      toast.error('Latitude must be between -90 and 90');
      return;
    }
    if (lng < -180 || lng > 180) {
      toast.error('Longitude must be between -180 and 180');
      return;
    }
    const newLoc: WeatherLocation = { id: Date.now(), name: newLocationName.trim(), lat: newLocationLat.trim(), lng: newLocationLng.trim() };
    const updated = [...weatherLocations, newLoc];
    setWeatherLocations(updated);
    saveWeatherLocations(updated);
    setNewLocationName('');
    setNewLocationLat('');
    setNewLocationLng('');
    toast.success('Weather location added successfully');
  };

  const handleDeleteWeatherLocation = (id: number) => {
    const updated = weatherLocations.filter(loc => loc.id !== id);
    setWeatherLocations(updated);
    saveWeatherLocations(updated);
    if (defaultLocation.id === id && updated.length > 0) {
      setDefaultLocation(updated[0]);
      saveDefaultLocation(updated[0]);
    }
    toast.success('Weather location deleted');
  };

  const handleSetDefaultLocation = (loc: WeatherLocation) => {
    setDefaultLocation(loc);
    saveDefaultLocation(loc);
    toast.success(`${loc.name} set as default location`);
  };

  // Precheck state
  const [droneType, setDroneType] = useState<string>('vtol');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    visualEquipment: true,
    aircraft: true,
    weather: true,
    battery: true,
    engine: true,
  });

  // Initialize precheck states for all drone types
  const [precheckState, setPrecheckState] = useState<Record<string, Record<string, Record<string, boolean>>>>(() => {
    const initial: Record<string, Record<string, Record<string, boolean>>> = {};
    Object.entries(precheckTypes).forEach(([typeKey, typeData]) => {
      initial[typeKey] = {};
      Object.entries(typeData.data).forEach(([key, category]) => {
        initial[typeKey][key] = {};
        category.items.forEach(item => {
          initial[typeKey][key][item] = false;
        });
      });
    });
    return initial;
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const togglePrecheckItem = (section: string, item: string) => {
    setPrecheckState(prev => ({
      ...prev,
      [droneType]: {
        ...prev[droneType],
        [section]: { ...prev[droneType][section], [item]: !prev[droneType][section][item] }
      }
    }));
  };

  const getSectionIcon = (icon: string) => {
    switch (icon) {
      case 'camera': return <Camera className="w-5 h-5" />;
      case 'plane': return <Plane className="w-5 h-5" />;
      case 'cloud': return <Cloud className="w-5 h-5" />;
      case 'battery': return <Battery className="w-5 h-5" />;
      case 'engine': return <SettingsIcon className="w-5 h-5" />;
      case 'ship': return <Ship className="w-5 h-5" />;
      case 'anchor': return <Anchor className="w-5 h-5" />;
      case 'waves': return <Waves className="w-5 h-5" />;
      default: return <ClipboardCheck className="w-5 h-5" />;
    }
  };

  const getSectionProgress = (sectionKey: string) => {
    const section = precheckState[droneType]?.[sectionKey];
    if (!section) return { checked: 0, total: 0 };
    const total = Object.keys(section).length;
    const checked = Object.values(section).filter(Boolean).length;
    return { checked, total };
  };

  const activePrecheckItems = precheckTypes[droneType].data;

  const handleSave = (message: string) => {
    toast.success('Settings saved successfully!', {
      description: message,
    });
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
    }
  };

  const handleToggleAIModel = (modelId: number) => {
    setAiModels(aiModels.map(m =>
      m.id === modelId ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' } : m
    ));
    toast.success('AI Model status updated');
  };

  const handleExportData = () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mariview-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully!');
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        importAllData(data);
        toast.success('Data imported successfully! Refreshing page...');
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        toast.error('Failed to import data. Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure you want to clear ALL data? This action cannot be undone!')) {
      clearAllStorage();
      toast.success('All data cleared! Refreshing page...');
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Toaster />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl">Settings</h1>
        <p className="text-muted-foreground text-sm md:text-base">System configuration and management</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="flex w-full overflow-x-auto bg-muted">
          <TabsTrigger value="users" className="text-xs sm:text-sm flex-1 min-w-[100px]">
            <User className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
            <span className="truncate">Users</span>
          </TabsTrigger>
          <TabsTrigger value="precheck" className="text-xs sm:text-sm flex-1 min-w-[120px]">
            <ClipboardCheck className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
            <span className="truncate">Precheck</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs sm:text-sm flex-1 min-w-[110px]">
            <Brain className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
            <span className="truncate">AI Models</span>
          </TabsTrigger>
          <TabsTrigger value="weather" className="text-xs sm:text-sm flex-1 min-w-[120px]">
            <MapPin className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
            <span className="truncate">Weather</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="text-xs sm:text-sm flex-1 min-w-[100px]">
            <Database className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
            <span className="truncate">Data</span>
          </TabsTrigger>
        </TabsList>

        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2>User Management</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage system users and permissions</p>
              </div>
              <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#21A68D] hover:bg-[#1a8a72]">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>Create a new user account with role and permissions</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input placeholder="Enter full name" className="bg-input" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="user@droneops.io" className="bg-input" />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select>
                        <SelectTrigger className="bg-input">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operator">Operator</SelectItem>
                          <SelectItem value="analyst">Analyst</SelectItem>
                          <SelectItem value="technician">Technician</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" placeholder="Enter password" className="bg-input" />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button variant="outline" className="flex-1" onClick={() => setIsAddUserOpen(false)}>
                        Cancel
                      </Button>
                      <Button className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]" onClick={() => {
                        handleSave('New user added successfully');
                        setIsAddUserOpen(false);
                      }}>
                        Create User
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Users Table */}
            <div className="space-y-3">
              {users.map(user => (
                <Card key={user.id} className="p-4 bg-muted/30 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-[#21A68D] flex items-center justify-center">
                        <span className="text-white font-semibold">{user.name.split(' ').map(n => n[0]).join('')}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{user.name}</p>
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: user.status === 'active' ? '#22c55e' : '#6b7280',
                              color: user.status === 'active' ? '#22c55e' : '#6b7280'
                            }}
                          >
                            {user.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="hidden md:block text-sm text-center">
                        <p className="text-muted-foreground">Role</p>
                        <p className="mt-1">{user.role}</p>
                      </div>
                      <div className="hidden lg:block text-sm text-center">
                        <p className="text-muted-foreground">Last Active</p>
                        <p className="mt-1">{user.lastActive}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="icon" variant="outline">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Precheck Settings Tab */}
        <TabsContent value="precheck" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#21A68D]/20 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-[#21A68D]" />
                  </div>
                  <div>
                    <h2>Precheck Settings</h2>
                    <p className="text-sm text-muted-foreground mt-1">Konfigurasi checklist precheck drone</p>
                  </div>
                </div>
                {/* Drone Type Selector */}
                <div className="flex gap-2">
                  {Object.entries(precheckTypes).map(([key, type]) => (
                    <Button
                      key={key}
                      variant={droneType === key ? 'default' : 'outline'}
                      style={droneType === key ? { backgroundColor: '#21A68D', color: '#fff' } : {}}
                      className={droneType !== key ? 'border-border' : ''}
                      onClick={() => setDroneType(key)}
                    >
                      {key === 'auv' ? <Ship className="w-4 h-4 mr-2" /> : <Plane className="w-4 h-4 mr-2" />}
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(activePrecheckItems).filter(([, section]) => section.items.length > 0).map(([sectionKey, section]) => {
                const { checked, total } = getSectionProgress(sectionKey);
                const isExpanded = expandedSections[sectionKey];
                const isComplete = checked === total && total > 0;

                return (
                  <Card key={sectionKey} className={`border-border overflow-hidden ${isComplete ? 'border-[#21A68D]/50' : ''
                    }`}>
                    {/* Section Header */}
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                      onClick={() => toggleSection(sectionKey)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionKey === 'visualEquipment' ? 'bg-blue-500/20 text-blue-400' :
                          sectionKey === 'aircraft' ? 'bg-[#21A68D]/20 text-[#21A68D]' :
                            sectionKey === 'weather' ? 'bg-sky-500/20 text-sky-400' :
                              'bg-yellow-500/20 text-yellow-400'
                          }`}>
                          {getSectionIcon(section.icon)}
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold">{section.label}</h3>
                          <p className="text-xs text-muted-foreground">{checked}/{total} items checked</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isComplete && (
                          <Badge variant="outline" style={{ borderColor: '#21A68D', color: '#21A68D' }}>
                            Complete
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Section Content */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        {section.items.map((item, idx) => (
                          <div
                            key={item}
                            className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer ${idx !== section.items.length - 1 ? 'border-b border-border/50' : ''
                              }`}
                            onClick={() => togglePrecheckItem(sectionKey, item)}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${precheckState[droneType]?.[sectionKey]?.[item]
                              ? 'bg-[#21A68D] border-[#21A68D]'
                              : 'border-muted-foreground/30'
                              }`}>
                              {precheckState[droneType]?.[sectionKey]?.[item] && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm ${precheckState[droneType]?.[sectionKey]?.[item] ? 'text-muted-foreground line-through' : ''
                              }`}>
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Summary & Save */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {Object.keys(activePrecheckItems).reduce((acc, key) => acc + getSectionProgress(key).checked, 0)} / {Object.keys(activePrecheckItems).reduce((acc, key) => acc + getSectionProgress(key).total, 0)} total items checked
              </div>
              <Button
                className="bg-[#21A68D] hover:bg-[#1a8a72]"
                onClick={() => handleSave('Precheck settings saved successfully')}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Precheck Settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* AI Parameter Configuration Tab */}
        <TabsContent value="ai" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <h2>AI Parameter Configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage AI models and detection parameters</p>
            </div>

            {/* AI Models List */}
            <div className="space-y-3">
              {aiModels.map(model => (
                <Card key={model.id} className="p-4 bg-muted/30 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg">{model.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {model.version}
                        </Badge>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: model.status === 'active' ? '#22c55e' : '#6b7280',
                            color: model.status === 'active' ? '#22c55e' : '#6b7280'
                          }}
                        >
                          {model.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Confidence Threshold</p>
                          <p className="mt-1 text-lg">{model.confidence}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Updated</p>
                          <p className="mt-1">{model.lastUpdated}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <div className="mt-1">
                            <Switch
                              checked={model.status === 'active'}
                              onCheckedChange={() => handleToggleAIModel(model.id)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Confidence Slider */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <Label>Confidence Threshold</Label>
                          <span className="text-muted-foreground">{model.confidence}%</span>
                        </div>
                        <Slider
                          defaultValue={[model.confidence]}
                          max={100}
                          step={1}
                          className="[&_[role=slider]]:bg-[#21A68D]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum confidence level for AI detections
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Global AI Settings */}
            <Card className="p-4 bg-muted/30 border-border mt-6">
              <h3 className="mb-4">Global AI Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Real-time Processing</Label>
                    <p className="text-xs text-muted-foreground mt-1">Process detections during live missions</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-save Detection Results</Label>
                    <p className="text-xs text-muted-foreground mt-1">Automatically save AI detection data</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Send Detection Alerts</Label>
                    <p className="text-xs text-muted-foreground mt-1">Notify when critical detections occur</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </Card>

            <div className="flex justify-end pt-4">
              <Button
                className="bg-[#21A68D] hover:bg-[#1a8a72]"
                onClick={() => handleSave('AI parameters saved successfully')}
              >
                <Save className="w-4 h-4 mr-2" />
                Save AI Settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Weather Location Tab */}
        <TabsContent value="weather" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h2>Weather Location</h2>
                  <p className="text-sm text-muted-foreground mt-1">Konfigurasi lokasi untuk data cuaca dan center point dashboard</p>
                </div>
              </div>
            </div>

            {/* Default Location Info */}
            <Card className="p-4 bg-[#21A68D]/10 border-[#21A68D]/30 mb-6">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <div>
                  <p className="text-sm font-semibold">Default Location: <span className="text-[#21A68D]">{defaultLocation.name}</span></p>
                  <p className="text-xs text-muted-foreground">Lat: {defaultLocation.lat} | Lng: {defaultLocation.lng} — Digunakan sebagai center point dashboard</p>
                </div>
              </div>
            </Card>

            {/* Add New Location Form */}
            <Card className="p-5 bg-muted/30 border-border mb-6">
              <h3 className="text-base mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#21A68D]" />
                Tambah Lokasi Baru
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nama Lokasi</Label>
                  <Input
                    placeholder="Contoh: Jakarta"
                    className="bg-input"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Contoh: -6.2088"
                    className="bg-input"
                    value={newLocationLat}
                    onChange={(e) => setNewLocationLat(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Range: -90 to 90</p>
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Contoh: 106.8456"
                    className="bg-input"
                    value={newLocationLng}
                    onChange={(e) => setNewLocationLng(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Range: -180 to 180</p>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  className="bg-[#21A68D] hover:bg-[#1a8a72]"
                  onClick={handleAddWeatherLocation}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Lokasi
                </Button>
              </div>
            </Card>

            {/* Saved Locations List */}
            <div>
              <h3 className="text-base mb-4">Lokasi Tersimpan</h3>
              {weatherLocations.length === 0 ? (
                <Card className="p-8 bg-muted/30 border-border text-center">
                  <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">Belum ada lokasi. Tambahkan lokasi cuaca di atas.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {weatherLocations.map(loc => (
                    <Card key={loc.id} className={`p-4 bg-muted/30 border-border ${defaultLocation.id === loc.id ? 'border-[#21A68D]/50 bg-[#21A68D]/5' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${defaultLocation.id === loc.id ? 'bg-[#21A68D]/20' : 'bg-sky-500/20'}`}>
                            {defaultLocation.id === loc.id ? (
                              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                            ) : (
                              <MapPin className="w-5 h-5 text-sky-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{loc.name}</p>
                              {defaultLocation.id === loc.id && (
                                <Badge variant="outline" style={{ borderColor: '#21A68D', color: '#21A68D' }} className="text-[10px]">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Lat: {loc.lat} &nbsp;|&nbsp; Lng: {loc.lng}
                            </p>
                          </div>
                          <div className="hidden md:flex gap-6 text-sm">
                            <div className="text-center">
                              <p className="text-muted-foreground">Latitude</p>
                              <p className="mt-1 font-mono">{loc.lat}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-muted-foreground">Longitude</p>
                              <p className="mt-1 font-mono">{loc.lng}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {defaultLocation.id !== loc.id && (
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white"
                              onClick={() => handleSetDefaultLocation(loc)}
                              title="Set as Default"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="outline"
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                            onClick={() => handleDeleteWeatherLocation(loc.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Save Locations Button */}
            <div className="flex justify-end pt-4 mt-4 border-t border-border">
              <Button
                className="bg-[#21A68D] hover:bg-[#1a8a72]"
                onClick={() => {
                  saveWeatherLocations(weatherLocations);
                  saveDefaultLocation(defaultLocation);
                  handleSave('Weather locations saved successfully');
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Weather Locations
              </Button>
            </div>
          </Card>

          {/* ── Flight Weather Policy ── */}
          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h2>Flight Weather Policy</h2>
                    <p className="text-sm text-muted-foreground mt-1">Batasan cuaca untuk operasi penerbangan drone</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleResetPolicy} className="text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset Default
                </Button>
              </div>
            </div>

            {/* Enforcement Mode */}
            <Card className={`p-4 mb-6 border-2 ${
              flightPolicy.enforcementMode === 'NO_FLY'
                ? 'bg-red-500/5 border-red-500/30'
                : 'bg-yellow-500/5 border-yellow-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Enforcement Mode
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {flightPolicy.enforcementMode === 'NO_FLY'
                      ? 'Penerbangan DIBLOKIR saat cuaca melebihi batas'
                      : 'Tampilkan WARNING tapi pilot bisa override'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={flightPolicy.enforcementMode === 'NO_FLY' ? 'default' : 'outline'}
                    style={flightPolicy.enforcementMode === 'NO_FLY' ? { backgroundColor: '#ef4444' } : {}}
                    onClick={() => handleUpdatePolicy({ enforcementMode: 'NO_FLY' })}
                  >
                    🚫 NO FLY
                  </Button>
                  <Button
                    size="sm"
                    variant={flightPolicy.enforcementMode === 'CAUTION' ? 'default' : 'outline'}
                    style={flightPolicy.enforcementMode === 'CAUTION' ? { backgroundColor: '#f59e0b' } : {}}
                    onClick={() => handleUpdatePolicy({ enforcementMode: 'CAUTION' })}
                  >
                    ⚠️ CAUTION
                  </Button>
                </div>
              </div>
            </Card>

            {/* Threshold Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Max Wind Speed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-blue-400" />
                    Max Wind Speed
                  </Label>
                  <span className="text-sm font-bold text-white">{flightPolicy.maxWindKn} kn</span>
                </div>
                <Slider
                  value={[flightPolicy.maxWindKn]}
                  onValueChange={([v]) => handleUpdatePolicy({ maxWindKn: v })}
                  min={5}
                  max={50}
                  step={1}
                  className="[&_[role=slider]]:bg-blue-400"
                />
                <p className="text-xs text-muted-foreground">Kecepatan angin maksimum yang diizinkan</p>
              </div>

              {/* Max Gust Speed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-purple-400" />
                    Max Gust Speed
                  </Label>
                  <span className="text-sm font-bold text-white">{flightPolicy.maxGustKn} kn</span>
                </div>
                <Slider
                  value={[flightPolicy.maxGustKn]}
                  onValueChange={([v]) => handleUpdatePolicy({ maxGustKn: v })}
                  min={5}
                  max={60}
                  step={1}
                  className="[&_[role=slider]]:bg-purple-400"
                />
                <p className="text-xs text-muted-foreground">Kecepatan hembusan angin maksimum</p>
              </div>

              {/* Min Visibility */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-green-400" />
                    Min Visibility
                  </Label>
                  <span className="text-sm font-bold text-white">{flightPolicy.minVisibilityKm} km</span>
                </div>
                <Slider
                  value={[flightPolicy.minVisibilityKm]}
                  onValueChange={([v]) => handleUpdatePolicy({ minVisibilityKm: v })}
                  min={1}
                  max={20}
                  step={0.5}
                  className="[&_[role=slider]]:bg-green-400"
                />
                <p className="text-xs text-muted-foreground">Visibilitas minimum untuk penerbangan</p>
              </div>

              {/* Max Humidity */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-400" />
                    Max Humidity
                  </Label>
                  <span className="text-sm font-bold text-white">{flightPolicy.maxHumidity}%</span>
                </div>
                <Slider
                  value={[flightPolicy.maxHumidity]}
                  onValueChange={([v]) => handleUpdatePolicy({ maxHumidity: v })}
                  min={50}
                  max={100}
                  step={1}
                  className="[&_[role=slider]]:bg-sky-400"
                />
                <p className="text-xs text-muted-foreground">Kelembaban maksimum yang diizinkan</p>
              </div>
            </div>

            {/* Blocked Weather Types */}
            <Card className="p-4 bg-muted/30 border-border">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Blocked Weather Types
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Kondisi cuaca yang otomatis memblokir penerbangan</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'Thunderstorm', label: '⛈ Badai Petir', critical: true },
                  { key: 'Tornado', label: '🌪 Tornado', critical: true },
                  { key: 'Squall', label: '💨 Badai Angin', critical: true },
                  { key: 'Rain', label: '🌧 Hujan', critical: false },
                  { key: 'Snow', label: '❄️ Salju', critical: false },
                  { key: 'Fog', label: '🌫 Kabut', critical: false },
                  { key: 'Mist', label: '🌫 Kabut Tipis', critical: false },
                  { key: 'Haze', label: '🌫 Kabur', critical: false },
                ].map(({ key, label, critical }) => {
                  const isChecked = flightPolicy.blockedWeather.includes(key);
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-muted/20 border-border hover:border-muted-foreground/30'
                      }`}
                      onClick={() => handleToggleBlockedWeather(key)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-red-500 border-red-500'
                          : 'border-muted-foreground/30'
                      }`}>
                        {isChecked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-medium">{label}</span>
                      {critical && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 border-red-500/50 text-red-400 ml-auto">CRITICAL</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Active Policy Summary */}
            <Card className={`p-4 mt-4 border-2 ${
              flightPolicy.enforcementMode === 'NO_FLY'
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-yellow-500/5 border-yellow-500/20'
            }`}>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Active Policy Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Wind</p>
                  <p className="font-bold">≤ {flightPolicy.maxWindKn} kn</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Gust</p>
                  <p className="font-bold">≤ {flightPolicy.maxGustKn} kn</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Visibility</p>
                  <p className="font-bold">≥ {flightPolicy.minVisibilityKm} km</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Humidity</p>
                  <p className="font-bold">≤ {flightPolicy.maxHumidity}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Mode</p>
                  <Badge variant="outline" className={`mt-0.5 text-[10px] ${
                    flightPolicy.enforcementMode === 'NO_FLY'
                      ? 'border-red-500 text-red-500'
                      : 'border-yellow-500 text-yellow-500'
                  }`}>
                    {flightPolicy.enforcementMode === 'NO_FLY' ? '🚫 NO FLY' : '⚠️ CAUTION'}
                  </Badge>
                </div>
              </div>
            </Card>
          </Card>
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <h2>Data Management</h2>
              <p className="text-sm text-muted-foreground mt-1">Export, import, and manage application data</p>
            </div>

            {/* Storage Info */}
            <Card className="p-4 bg-muted/30 border-border mb-6">
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-[#21A68D] mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-base mb-2">Local Storage</h3>
                  <p className="text-sm text-muted-foreground">
                    Data disimpan di browser localStorage. Data akan tetap ada setelah refresh,
                    tetapi terbatas pada device ini saja.
                  </p>
                </div>
              </div>
            </Card>

            {/* Export Data */}
            <Card className="p-4 bg-muted/30 border-border mb-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base mb-1 flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#21A68D]" />
                    Export Data
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Download backup semua data (missions, drones, assets, flights, settings)
                  </p>
                </div>
                <Button
                  onClick={handleExportData}
                  className="bg-[#21A68D] hover:bg-[#1a8a72]"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </Card>

            {/* Import Data */}
            <Card className="p-4 bg-muted/30 border-border mb-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base mb-1 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#0F4C75]" />
                    Import Data
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Restore data dari file backup. Akan menimpa semua data yang ada.
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                    id="import-file"
                  />
                  <Button
                    onClick={() => document.getElementById('import-file')?.click()}
                    variant="outline"
                    className="border-[#0F4C75] text-[#0F4C75] hover:bg-[#0F4C75] hover:text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </div>
              </div>
            </Card>

            {/* Clear All Data */}
            <Card className="p-4 bg-muted/30 border-border border-red-900/20">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base mb-1 flex items-center gap-2 text-red-500">
                    <Trash className="w-4 h-4" />
                    Clear All Data
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Hapus semua data dan reset ke default. <strong>Tindakan ini tidak dapat dibatalkan!</strong>
                  </p>
                </div>
                <Button
                  onClick={handleClearAllData}
                  variant="destructive"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </Card>

            {/* Data Summary */}
            <Card className="p-4 bg-muted/30 border-border mt-6">
              <h3 className="mb-4">Data Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Storage Keys</p>
                  <p className="mt-1 text-lg">5</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="mt-1">{new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Storage Type</p>
                  <p className="mt-1">LocalStorage</p>
                </div>
              </div>
            </Card>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}