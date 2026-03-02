
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from './ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import {
    Search,
    Filter,
    Download,
    Clock,
    User,
    Activity,
    AlertTriangle,
    CheckCircle,
    FileText,
    Settings,
    ShieldAlert
} from 'lucide-react';
import { Button } from './ui/button';

// Mock Data for Activity Logs
const mockLogs = [
    {
        id: 'LOG-001',
        timestamp: '2026-02-11 13:45:22',
        user: 'Commander',
        action: 'Mission Started',
        details: 'Initiated mission "Port Surveillance - Kupang"',
        category: 'Mission',
        status: 'success',
    },
    {
        id: 'LOG-002',
        timestamp: '2026-02-11 13:40:15',
        user: 'System',
        action: 'Drone Diagnostics',
        details: 'Pre-flight check completed for Pyrhos X V1',
        category: 'System',
        status: 'success',
    },
    {
        id: 'LOG-003',
        timestamp: '2026-02-11 13:35:00',
        user: 'Operator 01',
        action: 'Settings Update',
        details: 'Updated map layer preferences',
        category: 'Settings',
        status: 'info',
    },
    {
        id: 'LOG-004',
        timestamp: '2026-02-11 13:20:45',
        user: 'System',
        action: 'Connection Warning',
        details: 'High latency detected on link 2',
        category: 'Network',
        status: 'warning',
    },
    {
        id: 'LOG-005',
        timestamp: '2026-02-11 13:15:10',
        user: 'Commander',
        action: 'User Login',
        details: 'Successful login from IP 192.168.1.5',
        category: 'Security',
        status: 'success',
    },
    {
        id: 'LOG-006',
        timestamp: '2026-02-11 12:55:33',
        user: 'Operator 02',
        action: 'Manual Override',
        details: 'Took manual control of UAV-002',
        category: 'Mission',
        status: 'warning',
    },
    {
        id: 'LOG-007',
        timestamp: '2026-02-11 12:40:00',
        user: 'System',
        action: 'Data Sync',
        details: 'Telemetry data synced to cloud storage',
        category: 'System',
        status: 'success',
    },
    {
        id: 'LOG-008',
        timestamp: '2026-02-11 12:10:15',
        user: 'System',
        action: 'AI Detection',
        details: 'Vessel hull number identified with 92% confidence',
        category: 'AI Analysis',
        status: 'info',
    },
    {
        id: 'LOG-009',
        timestamp: '2026-02-11 11:50:50',
        user: 'Admin',
        action: 'Firmware Update',
        details: 'Failed to update firmware for Ground Station 1',
        category: 'Maintenance',
        status: 'error',
    },
    {
        id: 'LOG-010',
        timestamp: '2026-02-11 11:30:22',
        user: 'Commander',
        action: 'Geofence Created',
        details: 'New restricted zone added: Sector 4',
        category: 'Mission',
        status: 'success',
    },
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'success':
            return 'text-green-500 bg-green-500/10 border-green-500/20';
        case 'warning':
            return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        case 'error':
            return 'text-red-500 bg-red-500/10 border-red-500/20';
        case 'info':
            return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        default:
            return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
};

const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'Mission':
            return <Activity className="w-4 h-4" />;
        case 'System':
            return <Settings className="w-4 h-4" />;
        case 'Security':
            return <ShieldAlert className="w-4 h-4" />;
        case 'AI Analysis':
            return <FileText className="w-4 h-4" />;
        case 'Network':
            return <Activity className="w-4 h-4" />; // Or Wifi icon if available
        default:
            return <FileText className="w-4 h-4" />;
    }
};

export default function ActivityLog() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    const filteredLogs = mockLogs.filter((log) => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = filterCategory === 'all' || log.category === filterCategory;
        const matchesStatus = filterStatus === 'all' || log.status === filterStatus;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    return (
        <div className="p-6 space-y-6 bg-background min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#21A68D] to-[#2DD4BF]">
                        Activity Log
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        System events, user actions, and audit trails
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="border-[#21A68D]/30 hover:bg-[#21A68D]/10">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Filters and Search */}
            <Card className="border-[#21A68D]/20 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search logs..."
                                className="pl-9 bg-background/50 border-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-[180px] bg-background/50">
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-muted-foreground" />
                                        <SelectValue placeholder="Category" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="Mission">Mission</SelectItem>
                                    <SelectItem value="System">System</SelectItem>
                                    <SelectItem value="Security">Security</SelectItem>
                                    <SelectItem value="Settings">Settings</SelectItem>
                                    <SelectItem value="AI Analysis">AI Analysis</SelectItem>
                                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-[150px] bg-background/50">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                                        <SelectValue placeholder="Status" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="warning">Warning</SelectItem>
                                    <SelectItem value="error">Error</SelectItem>
                                    <SelectItem value="info">Info</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="border-[#21A68D]/20 bg-card/50 backdrop-blur-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-[#21A68D]/10">
                            <TableRow className="hover:bg-transparent border-[#21A68D]/20">
                                <TableHead className="w-[180px] font-semibold text-[#21A68D]">Timestamp</TableHead>
                                <TableHead className="font-semibold text-[#21A68D]">Action</TableHead>
                                <TableHead className="font-semibold text-[#21A68D]">User</TableHead>
                                <TableHead className="font-semibold text-[#21A68D]">Category</TableHead>
                                <TableHead className="font-semibold text-[#21A68D]">Details</TableHead>
                                <TableHead className="text-right font-semibold text-[#21A68D]">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-[#21A68D]/5 border-border/50">
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {log.timestamp}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{log.action}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                                                    {log.user.charAt(0)}
                                                </div>
                                                <span className="text-sm">{log.user}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="gap-1 font-normal bg-background/50">
                                                {getCategoryIcon(log.category)}
                                                {log.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-md truncate">
                                            {log.details}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline" className={`capitalize ${getStatusColor(log.status)}`}>
                                                {log.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <Search className="w-8 h-8 opacity-20" />
                                            <p>No logs found matching your criteria</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
