import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { emailQueue } from '../services/queue.service';
import { LEGAL_TERMS_VERSION } from '../constants/legal';

export class AuthController {
    static async register(req: Request, res: Response) {
        try {
            const { name, cpf, email, phone, password, address, city, state, acceptedTerms } = req.body;

            if (!acceptedTerms) {
                return res.status(400).json({ error: 'É necessário aceitar os Termos de Uso e a Política de Privacidade' });
            }
            
            const cleanCpf = cpf.replace(/\D/g, '');
            if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
                return res.status(400).json({ error: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos' });
            }

            const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { cpf: cleanCpf }] } });
            if (exists) return res.status(400).json({ error: 'E-mail ou CPF já cadastrados' });

            const password_hash = await bcrypt.hash(password, 10);
            const user = await prisma.user.create({
                    data: { 
                    name, 
                    cpf: cleanCpf, 
                    email, 
                    phone: phone.replace(/\D/g, ''), 
                    password_hash, 
                    address,
                    city: city || null,
                    state: state || null,
                    acceptedTermsAt: new Date(),
                    acceptedTermsVersion: LEGAL_TERMS_VERSION,
                }
            });

            const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
            res.json({ user: { id: user.id, name: user.name, email: user.email, cpf: user.cpf, phone: user.phone, role: user.role, federationYear: user.federationYear, city: user.city, state: user.state }, token });
        } catch (e) {
            res.status(500).json({ error: 'Erro ao registrar usuário' });
        }
    }

    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

            const matches = await bcrypt.compare(password, user.password_hash);
            if (!matches) return res.status(401).json({ error: 'Senha incorreta' });

            const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
            res.json({ user: { id: user.id, name: user.name, email: user.email, cpf: user.cpf, phone: user.phone, role: user.role, federationYear: user.federationYear, city: user.city, state: user.state }, token });
        } catch (e) {
            res.status(500).json({ error: 'Erro no login' });
        }
    }

    static async me(req: Request, res: Response) {
        const id = (req as any).user?.id;
        if (!id) return res.status(401).json({ error: 'Unauthorized' });
        const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, cpf: true, phone: true, role: true, federationYear: true, city: true, state: true } });
        res.json(user);
    }

    static async updateProfile(req: Request, res: Response) {
        try {
            const id = (req as any).user?.id;
            if (!id) return res.status(401).json({ error: 'Unauthorized' });

            const { name, cpf, phone, city, state } = req.body;
            const updateData: any = {};

            if (name && name.trim()) {
                updateData.name = name.trim();
            }

            if (cpf) {
                const cleanCpf = cpf.replace(/\D/g, '');
                if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
                    return res.status(400).json({ error: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos' });
                }
                // Check if CPF is already used by another user
                const existing = await prisma.user.findFirst({ where: { cpf: cleanCpf, NOT: { id } } });
                if (existing) {
                    return res.status(400).json({ error: 'Este CPF já está cadastrado por outro usuário' });
                }
                updateData.cpf = cleanCpf;
            }

            if (phone) {
                updateData.phone = phone.replace(/\D/g, '');
            }

            if (city !== undefined) {
                updateData.city = city || null;
            }

            if (state !== undefined) {
                updateData.state = state || null;
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: 'Nenhum dado para atualizar' });
            }

            const user = await prisma.user.update({
                where: { id },
                data: updateData,
                select: { id: true, name: true, email: true, cpf: true, phone: true, role: true, federationYear: true, city: true, state: true }
            });

            res.json(user);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Erro ao atualizar perfil' });
        }
    }

    static async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;
            const user = await prisma.user.findUnique({ where: { email } });
            
            if (!user) {
                // To avoid email enumeration, we return 200 even if user doesn't exist
                return res.json({ message: 'Se o e-mail existir em nossa base, um link de recuperação será enviado.' });
            }

            const token = crypto.randomUUID();
            const expires = new Date(Date.now() + 3600000); // 1 hour

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    resetToken: token,
                    resetTokenExpires: expires
                }
            });

            const resetLink = `${process.env.FRONTEND_URL || 'https://zeusevolution.com.br'}/reset-password/${token}`;
            await emailQueue.add('send-password-reset', {
                email: user.email,
                name: user.name,
                resetLink
            });

            res.json({ message: 'Se o e-mail existir em nossa base, um link de recuperação será enviado.' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Erro ao processar recuperação de senha' });
        }
    }

    static async resetPassword(req: Request, res: Response) {
        try {
            const { token, newPassword } = req.body;

            const user = await prisma.user.findFirst({
                where: {
                    resetToken: token,
                    resetTokenExpires: { gt: new Date() }
                }
            });

            if (!user) {
                return res.status(400).json({ error: 'Token inválido ou expirado' });
            }

            const password_hash = await bcrypt.hash(newPassword, 10);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    password_hash,
                    resetToken: null,
                    resetTokenExpires: null
                }
            });

            res.json({ message: 'Senha atualizada com sucesso!' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Erro ao resetar senha' });
        }
    }
}
