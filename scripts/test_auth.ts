import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'admin@zeusevolution.com.br' } })
    if (!user) return console.log('User not found')
    
    console.log('User from DB:', user)
    
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' })
    
    try {
        const res = await fetch('http://localhost:3000/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        console.log('Response from /auth/me:', data)
    } catch (e: any) {
        console.error('Error hitting /auth/me:', e.message)
    }
}
main()
