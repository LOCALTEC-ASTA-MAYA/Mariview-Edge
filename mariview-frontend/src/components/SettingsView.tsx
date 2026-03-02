import { useState, useEffect } from 'react';
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
import { User, Settings as SettingsIcon, Brain, Plus, Edit, Trash2, Shield, Save, UserPlus, Palette, RotateCcw, Database, Download, Upload, Trash, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { exportAllData, importAllData, clearAllStorage } from '../utils/storage';

// Users fetched from Keycloak via backend API
interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  enabled: boolean;
  createdTimestamp?: number;
}

const droneParamsData = [
  { id: 'UAV-001', name: 'Pyrhos X V1', type: 'UAV', maxAltitude: 150, maxSpeed: 20, batteryCapacity: 22000, flightTime: 45 },
  { id: 'UAV-002', name: 'AR-2 Aerial', type: 'UAV', maxAltitude: 120, maxSpeed: 18, batteryCapacity: 16000, flightTime: 38 },
  { id: 'AUV-001', name: 'AquaScan Alpha', type: 'AUV', maxDepth: 500, maxSpeed: 3, batteryCapacity: 18000, operationTime: 120 },
  { id: 'AUV-002', name: 'DeepSeeker Pro', type: 'AUV', maxDepth: 1000, maxSpeed: 2.5, batteryCapacity: 24000, operationTime: 180 },
];

const aiModelsData = [
  { id: 1, name: 'Structure Inspection', version: 'v2.4', confidence: 94, status: 'active', lastUpdated: '2025-01-15' },
  { id: 2, name: 'Vehicle Counting', version: 'v3.1', confidence: 92, status: 'active', lastUpdated: '2025-01-18' },
  { id: 3, name: 'People Detection', version: 'v2.8', confidence: 89, status: 'active', lastUpdated: '2025-01-10' },
  { id: 4, name: 'Seabed Mapping', version: 'v1.6', confidence: 91, status: 'active', lastUpdated: '2025-01-12' },
  { id: 5, name: 'Crowd Estimation', version: 'v2.2', confidence: 88, status: 'inactive', lastUpdated: '2025-01-05' },
];

export default function SettingsView() {
  const [users, setUsers] = useState<KeycloakUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [droneParams, setDroneParams] = useState(droneParamsData);
  const [aiModels, setAiModels] = useState(aiModelsData);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditDroneOpen, setIsEditDroneOpen] = useState(false);
  const [selectedDrone, setSelectedDrone] = useState<any>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const { colors, updateColor, resetColors } = useTheme();
  const { user: currentUser } = useAuth();
  const isCommander = currentUser?.roles?.includes('COMMANDER');

  // New user form state
  const [newUserForm, setNewUserForm] = useState({
    username: '', email: '', firstName: '', lastName: '', password: '', role: '',
  });

  // Fetch users from backend on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const resp = await fetch('/api/admin/users', { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        setUsers(data || []);
      } else if (resp.status === 403) {
        // Not COMMANDER — show empty with message
        setUsers([]);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSave = (message: string) => {
    toast.success('Settings saved successfully!', {
      description: message,
    });
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        const resp = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (resp.ok) {
          setUsers(users.filter(u => u.id !== userId));
          toast.success('User deleted successfully');
        } else {
          toast.error('Failed to delete user');
        }
      } catch {
        toast.error('Failed to delete user');
      }
    }
  };

  const handleCreateUser = async () => {
    setIsCreatingUser(true);
    try {
      const resp = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newUserForm),
      });
      if (resp.ok) {
        toast.success('User created successfully!');
        setIsAddUserOpen(false);
        setNewUserForm({ username: '', email: '', firstName: '', lastName: '', password: '', role: '' });
        fetchUsers(); // Refresh list
      } else {
        const text = await resp.text();
        toast.error(text || 'Failed to create user');
      }
    } catch {
      toast.error('Failed to create user');
    } finally {
      setIsCreatingUser(false);
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
        <TabsList className="grid w-full grid-cols-4 bg-muted">
          <TabsTrigger value="users" className="text-xs sm:text-sm">
            <User className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="drone" className="text-xs sm:text-sm">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Drones
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs sm:text-sm">
            <Brain className="w-4 h-4 mr-2" />
            AI Models
          </TabsTrigger>
          <TabsTrigger value="data" className="text-xs sm:text-sm">
            <Database className="w-4 h-4 mr-2" />
            Data
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
                    <DialogDescription>Create a new user account in Keycloak with role assignment</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          placeholder="First name"
                          className="bg-input"
                          value={newUserForm.firstName}
                          onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          placeholder="Last name"
                          className="bg-input"
                          value={newUserForm.lastName}
                          onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        placeholder="Enter username"
                        className="bg-input"
                        value={newUserForm.username}
                        onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="user@locallitix.com"
                        className="bg-input"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={newUserForm.role}
                        onValueChange={(val) => setNewUserForm({ ...newUserForm, role: val })}
                      >
                        <SelectTrigger className="bg-input">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COMMANDER">Commander</SelectItem>
                          <SelectItem value="PILOT">Pilot</SelectItem>
                          <SelectItem value="OPERATOR">Operator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        className="bg-input"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button variant="outline" className="flex-1" onClick={() => setIsAddUserOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]"
                        onClick={handleCreateUser}
                        disabled={isCreatingUser || !newUserForm.username || !newUserForm.email || !newUserForm.password || !newUserForm.role}
                      >
                        {isCreatingUser ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                        ) : (
                          'Create User'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Users Table */}
            <div className="space-y-3">
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#21A68D]" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading users from Keycloak...</span>
                </div>
              ) : !isCommander ? (
                <div className="text-center py-8">
                  <Shield className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">COMMANDER role required to manage users</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No users found</p>
                </div>
              ) : (
                users.map(user => {
                  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
                  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
                  const role = user.roles?.[0] || 'No Role';
                  return (
                    <Card key={user.id} className="p-4 bg-muted/30 border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 rounded-full bg-[#21A68D] flex items-center justify-center">
                            <span className="text-white font-semibold">{initials}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{fullName}</p>
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: user.enabled ? '#22c55e' : '#6b7280',
                                  color: user.enabled ? '#22c55e' : '#6b7280'
                                }}
                              >
                                {user.enabled ? 'active' : 'disabled'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <div className="hidden md:block text-sm text-center">
                            <p className="text-muted-foreground">Role</p>
                            <p className="mt-1">{role}</p>
                          </div>
                          <div className="hidden lg:block text-sm text-center">
                            <p className="text-muted-foreground">Username</p>
                            <p className="mt-1">{user.username}</p>
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
                  );
                })
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Drone Parameter Configuration Tab */}
        <TabsContent value="drone" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <h2>Drone Parameter Configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure operational parameters for UAV and AUV</p>
            </div>

            {/* Drone Parameters List */}
            <div className="space-y-4">
              {droneParams.map(drone => (
                <Card key={drone.id} className="p-4 bg-muted/30 border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: drone.type === 'UAV' ? '#21A68D' : '#0F4C75',
                            color: drone.type === 'UAV' ? '#21A68D' : '#0F4C75'
                          }}
                        >
                          {drone.type}
                        </Badge>
                        <h3 className="text-lg">{drone.name}</h3>
                        <span className="text-sm text-muted-foreground">ID: {drone.id}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {drone.type === 'UAV' ? (
                          <>
                            <div>
                              <p className="text-muted-foreground">Max Altitude</p>
                              <p className="mt-1 text-lg">{drone.maxAltitude}m</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Max Speed</p>
                              <p className="mt-1 text-lg">{drone.maxSpeed} m/s</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Battery</p>
                              <p className="mt-1 text-lg">{drone.batteryCapacity} mAh</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Flight Time</p>
                              <p className="mt-1 text-lg">{drone.flightTime} min</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-muted-foreground">Max Depth</p>
                              <p className="mt-1 text-lg">{drone.maxDepth}m</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Max Speed</p>
                              <p className="mt-1 text-lg">{drone.maxSpeed} m/s</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Battery</p>
                              <p className="mt-1 text-lg">{drone.batteryCapacity} mAh</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Operation Time</p>
                              <p className="mt-1 text-lg">{drone.operationTime} min</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="ml-4"
                      onClick={() => {
                        setSelectedDrone(drone);
                        setIsEditDroneOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Edit Drone Dialog */}
          <Dialog open={isEditDroneOpen} onOpenChange={setIsEditDroneOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Drone Parameters</DialogTitle>
                <DialogDescription>
                  {selectedDrone && `Configure operational parameters for ${selectedDrone.name}`}
                </DialogDescription>
              </DialogHeader>
              {selectedDrone && (
                <div className="space-y-6 mt-4">
                  {selectedDrone.type === 'UAV' ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Max Altitude (meters)</Label>
                          <span className="text-sm text-muted-foreground">{selectedDrone.maxAltitude}m</span>
                        </div>
                        <Slider
                          defaultValue={[selectedDrone.maxAltitude]}
                          max={200}
                          step={10}
                          className="[&_[role=slider]]:bg-[#21A68D]"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Max Speed (m/s)</Label>
                          <span className="text-sm text-muted-foreground">{selectedDrone.maxSpeed} m/s</span>
                        </div>
                        <Slider
                          defaultValue={[selectedDrone.maxSpeed]}
                          max={30}
                          step={1}
                          className="[&_[role=slider]]:bg-[#21A68D]"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Battery Capacity (mAh)</Label>
                          <Input
                            type="number"
                            defaultValue={selectedDrone.batteryCapacity}
                            className="w-32 bg-input"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Max Flight Time (min)</Label>
                          <Input
                            type="number"
                            defaultValue={selectedDrone.flightTime}
                            className="w-32 bg-input"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Max Depth (meters)</Label>
                          <span className="text-sm text-muted-foreground">{selectedDrone.maxDepth}m</span>
                        </div>
                        <Slider
                          defaultValue={[selectedDrone.maxDepth]}
                          max={1500}
                          step={50}
                          className="[&_[role=slider]]:bg-[#0F4C75]"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Max Speed (m/s)</Label>
                          <span className="text-sm text-muted-foreground">{selectedDrone.maxSpeed} m/s</span>
                        </div>
                        <Slider
                          defaultValue={[selectedDrone.maxSpeed]}
                          max={5}
                          step={0.5}
                          className="[&_[role=slider]]:bg-[#0F4C75]"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Battery Capacity (mAh)</Label>
                          <Input
                            type="number"
                            defaultValue={selectedDrone.batteryCapacity}
                            className="w-32 bg-input"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Max Operation Time (min)</Label>
                          <Input
                            type="number"
                            defaultValue={selectedDrone.operationTime}
                            className="w-32 bg-input"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button variant="outline" className="flex-1" onClick={() => setIsEditDroneOpen(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]" onClick={() => {
                      handleSave('Drone parameters updated successfully');
                      setIsEditDroneOpen(false);
                    }}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
