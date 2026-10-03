import { Request, Response, NextFunction } from 'express';

export const requireRoles = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = (req as any).userRole;
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Acesso negado: Seu perfil não tem permissão para esta ação.' });
        }
        next();
    };
};
