
'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import * as api from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Shield, User as UserIcon, PlusCircle, Loader2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { AddUserDialog } from './add-user-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { DeleteUserDialog } from './delete-user-dialog';
import { useToast } from '@/hooks/use-toast';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
        const usersData = await api.getUsers();
        setUsers(usersData);
    } catch (error: any) {
        toast({ title: "Failed to fetch users", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser, fetchUsers]);

  const handleAddUser = async (newUser: Omit<User, 'id'>, password: string) => {
    try {
      await api.register(newUser.username, password, newUser.role);
      toast({ title: "User Added", description: `User ${newUser.username} has been created.` });
      fetchUsers(); // Refetch users to get the latest list
    } catch (error: any) {
      toast({ title: "Failed to add user", description: error.message, variant: "destructive" });
    }
  };

  const handleEditUser = async (updatedUser: User) => {
    try {
      await api.updateUser(updatedUser.id, updatedUser.username, updatedUser.role);
      toast({ title: "User Updated", description: `User ${updatedUser.username} has been updated.` });
      fetchUsers(); // Refetch users to reflect changes
    } catch (error: any) {
       toast({ title: "Failed to update user", description: error.message, variant: "destructive" });
    }
  };
  
  const handleDeleteUser = async (userId: number) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;

    try {
      await api.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      toast({ title: "User Deleted", description: `User ${userToDelete.username} has been deleted.`});
    } catch (error: any) {
      toast({ title: "Failed to delete user", description: error.message, variant: "destructive" });
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
            <div className='flex justify-between items-center'>
                <div>
                    <CardTitle>All Users</CardTitle>
                    <CardDescription>Add, edit, or remove users from the system.</CardDescription>
                </div>
                <Button onClick={() => setIsAddUserOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add User
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {users.map((user) => (
                        <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? (
                                <Shield className="mr-2 h-4 w-4" />
                            ) : (
                                <UserIcon className="mr-2 h-4 w-4" />
                            )}
                            {user.role}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === currentUser.id}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsEditUserOpen(true); }}>
                                    Edit User
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedUser(user); setIsDeleteUserOpen(true); }}>
                                    Delete User
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      
      <AddUserDialog 
        isOpen={isAddUserOpen} 
        onOpenChange={setIsAddUserOpen} 
        onAddUser={handleAddUser} 
      />
      {selectedUser && (
        <EditUserDialog 
            isOpen={isEditUserOpen}
            onOpenChange={setIsEditUserOpen}
            user={selectedUser}
            onEditUser={handleEditUser}
        />
      )}
      {selectedUser && (
        <DeleteUserDialog
            isOpen={isDeleteUserOpen}
            onOpenChange={setIsDeleteUserOpen}
            user={selectedUser}
            onDeleteUser={() => handleDeleteUser(selectedUser.id)}
        />
      )}
    </>
  );
}
