import React from 'react'
import { Card } from 'antd'
import { UserManagement } from '@/components/user-management'

export const AdminUsersModule: React.FC = () => {
    return (
        <Card style={{ borderRadius: 12 }}>
            <UserManagement />
        </Card>
    )
}
