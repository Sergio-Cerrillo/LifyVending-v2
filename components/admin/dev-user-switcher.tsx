'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { mockUsers } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';

/**
 * Componente de desarrollo para cambiar entre usuarios
 * Solo debe usarse en desarrollo, no en producción
 */
export function DevUserSwitcher() {
  const { currentUser, login } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || '1');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleUserChange = (userId: string) => {
    const user = mockUsers.find((u) => u.id === userId);
    if (user) {
      setSelectedUserId(userId);
      localStorage.setItem('currentUser', JSON.stringify(user));
      // Recargar la página para aplicar el cambio
      window.location.reload();
    }
  };

  // Solo mostrar en desarrollo y después de montar
  if (process.env.NODE_ENV === 'production' || !isMounted) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4" />
          Selector de Usuario (Dev)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Usuario actual: <span className="font-medium">{currentUser?.name}</span> (
          {currentUser?.role})
        </div>
        <Select value={selectedUserId} onValueChange={handleUserChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar usuario" />
          </SelectTrigger>
          <SelectContent>
            {mockUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} - {user.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          La página se recargará al cambiar de usuario
        </div>
      </CardContent>
    </Card>
  );
}
