"use client"

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
    // Get userEmail directly from the context
    const { userEmail, isLoading: authLoading } = useAuth(); 
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        // Client-side validation
        if (newPassword !== confirmNewPassword) {
            setError("New passwords do not match.");
            return;
        }
        if (newPassword.length < 12) {
            setError("New password must be at least 12 characters long.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.changePassword(currentPassword, newPassword);
            setSuccessMessage(response.message || "Password updated successfully!");
            // Clear fields on success
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err: any) {
            console.error("Change password error:", err);
            setError(err.message || "Failed to change password. Please check your current password.");
        } finally {
            setIsLoading(false);
        }
    };

    // Don't render the form until auth state is loaded
    if (authLoading) {
        return <div>Loading user settings...</div>; // Or a spinner component
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            {/* Display user email if available */}
            {userEmail && (
                <p className="text-muted-foreground mb-6">Account: {userEmail}</p>
            )}
            {!userEmail && (
                 <p className="text-muted-foreground mb-6">Loading account info...</p>
            )}

            <Card className="w-full max-w-lg mx-auto"> {/* Center card */}
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your account password below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        {successMessage && (
                             <Alert variant="default" className="bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200">
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <AlertDescription>{successMessage}</AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={12}
                                disabled={isLoading}
                            />
                             <p className="text-xs text-muted-foreground">
                                Must be at least 12 characters long.
                            </p>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                            <Input
                                id="confirmNewPassword"
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                required
                                minLength={12}
                                disabled={isLoading}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Updating Password...' : 'Update Password'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
} 