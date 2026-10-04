import { Request, Response } from 'express';
import { prisma } from '../prisma';

const defaultSettings = {
    id: 'default',
    title: 'Zeus Evolution',
    subtitle: 'Expo Fitness e Campeonato de Fisiculturismo',
    heroBanner: '',
    heroVideo: '',
    secondaryVideo: '',
    mission: 'Promover um evento de fisiculturismo e fitness de alto padrão, valorizando o atleta em todas as etapas – da estrutura à premiação – proporcionando uma experiência profissional, justa e memorável para competidores, público, patrocinadores e parceiros.',
    vision: 'Transformar o Zeus Evolution em um dos maiores eventos fitness do Brasil, unindo competição de alto nível, feira de negócios e experiências exclusivas, posicionando-se como referência nacional em estrutura, inovação e valorização do atleta.',
    values: '• Valorização do atleta: Reconhecer o esforço, a disciplina e a trajetória de cada competidor.\n• Excelência e profissionalismo: Entregar organização, estrutura e premiação em padrão nacional.\n• Transparência e ética: Atuar com respeito às regras, clareza nas informações e justiça nas decisões.\n• Inovação: Buscar constantemente evolução em formato, experiências e oportunidades dentro do evento.\n• Crescimento do esporte: Contribuir para o fortalecimento do fisiculturismo no cenário nacional.',
    historyTitle: 'A História do Zeus Evolution',
    historyText: 'ZEUS. MAIS QUE UM EVENTO, UM SISTEMA.\n\nO Zeus nasce com um propósito claro: elevar o padrão do fisiculturismo nacional e mundial. \nSomos um evento autossustentável, com estrutura própria e parcerias estratégicas que garantem qualidade, da produção dos troféus às camisetas, da capacitação da equipe à entrega final no palco.\nCriado, idealizado e fundado em Uberlândia  MG, por Luciano Gonzalez, embaixador da WPF Brasil, e com a Concessão do Ilmo Sr Reginaldo Gomes presidente da WBPF Brasil e levar a WBPF no seu lugar do cenário. \nO Zeus não improvisa. Aqui, tudo é planejado e executado com excelência.\nNosso modelo é simples e sólido: levamos uma estrutura completa, com equipe treinada.\nO parceiro local cuida da praça. O Zeus cuida do evento.\nTrabalhamos com transparência total: todos os custos operacionais são quitados, equipe, produção, premiação, estrutura, taxas e serviços. O investimento é respeitado. E o resultado é dividido de forma justa.\nO Zeus Evolution nasce para quebrar um padrão antigo onde o atleta paga caro, e recebe pouco.',
    instagramUrl: 'https://www.instagram.com/zeusevolutioncb?igsh=MWR1Y25lZWo1NDM3bw==',
    whatsappUrl: 'https://wa.me/553492440149',
    whatsappPhone: '+55 34 9244-0149',
};

export class SiteSettingController {
    static async getSettings(req: Request, res: Response) {
        try {
            let settings = await prisma.siteSetting.findUnique({
                where: { id: 'default' }
            });

            if (!settings) {
                settings = await prisma.siteSetting.create({
                    data: defaultSettings
                });
            }

            res.json(settings);
        } catch (error) {
            console.error('[SiteSettings] Erro ao buscar configurações:', error);
            // Fallback to in-memory defaults if DB has any temporary issue
            res.json(defaultSettings);
        }
    }

    static async updateSettings(req: Request, res: Response) {
        try {
            const data = req.body;

            const updated = await prisma.siteSetting.upsert({
                where: { id: 'default' },
                create: {
                    ...defaultSettings,
                    ...data,
                    id: 'default'
                },
                update: {
                    ...(data.title !== undefined && { title: data.title }),
                    ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
                    ...(data.heroBanner !== undefined && { heroBanner: data.heroBanner }),
                    ...(data.heroVideo !== undefined && { heroVideo: data.heroVideo }),
                    ...(data.secondaryVideo !== undefined && { secondaryVideo: data.secondaryVideo }),
                    ...(data.mission !== undefined && { mission: data.mission }),
                    ...(data.vision !== undefined && { vision: data.vision }),
                    ...(data.values !== undefined && { values: data.values }),
                    ...(data.historyTitle !== undefined && { historyTitle: data.historyTitle }),
                    ...(data.historyText !== undefined && { historyText: data.historyText }),
                    ...(data.instagramUrl !== undefined && { instagramUrl: data.instagramUrl }),
                    ...(data.whatsappUrl !== undefined && { whatsappUrl: data.whatsappUrl }),
                    ...(data.whatsappPhone !== undefined && { whatsappPhone: data.whatsappPhone }),
                }
            });

            res.json(updated);
        } catch (error) {
            console.error('[SiteSettings] Erro ao atualizar configurações:', error);
            res.status(500).json({ error: 'Erro ao atualizar configurações do site' });
        }
    }
}
