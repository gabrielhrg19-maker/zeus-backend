import { Request, Response } from 'express';
import { prisma } from '../prisma';

export const defaultSettingsByPage: Record<string, any> = {
    default: {
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
        historyText: `ZEUS. MAIS QUE UM EVENTO, UM SISTEMA.

O Zeus nasce com um propósito claro: elevar o padrão do fisiculturismo nacional e mundial. 
Somos um evento autossustentável, com estrutura própria e parcerias estratégicas que garantem qualidade, da produção dos troféus às camisetas, da capacitação da equipe à entrega final no palco.
Criado, idealizado e fundado em Uberlândia - MG, por Luciano Gonzalez. 
O Zeus não improvisa. Aqui, tudo é planejado e executado com excelência.
Nosso modelo é simples e sólido: levamos uma estrutura completa, com equipe treinada.
O parceiro local cuida da praça. O Zeus cuida do evento.
Trabalhamos com transparência total: todos os custos operacionais são quitados, equipe, produção, premiação, estrutura, taxas e serviços. O investimento é respeitado. E o resultado é dividido de forma justa.
O Zeus Evolution nasce para quebrar um padrão antigo onde o atleta paga caro, e recebe pouco.
No Zeus, o atleta tem premiações em dinheiro e as Inscrições são acessíveis.
O campeão Overall do Zeus Evolution não leva apenas um troféu, ele garante vaga no Campeonato Brasileiro com inscrição e hospedagem custeadas pelo Zeus. E se consagrando novamente, no cenário nacional…
O caminho se abre para o Mundial na Áustria
Aqui, o atleta não aposenta no seu auge, ele evolui.

O Zeus não segue o mercado.

O Zeus cria um novo padrão.`,
        instagramUrl: 'https://www.instagram.com/zeusevolutioncb?igsh=MWR1Y25lZWo1NDM3bw==',
        whatsappUrl: 'https://wa.me/553492440149',
        whatsappPhone: '+55 34 9244-0149',
    },
    'trophy-gonzales': {
        id: 'trophy-gonzales',
        title: 'Trophy Gonzales',
        subtitle: 'Excelência em premiações e reconhecimento.',
        heroBanner: '',
        heroVideo: '',
        secondaryVideo: '',
        mission: 'Criar troféus e medalhas que não sejam apenas objetos, mas símbolos eternos de conquista e glória.',
        vision: 'Ser a referência absoluta em design e qualidade de premiações esportivas personalizadas.',
        values: 'Qualidade Artesanal, Criatividade, Pontualidade e Reconhecimento.',
        historyTitle: 'Sobre a Trophy Gonzales',
        historyText: 'A Trophy Gonzales é referência em design e produção de troféus de alta definição para fisiculturismo e grandes competições. Peças exclusivas moldadas com padrão escultural.',
        instagramUrl: 'https://instagram.com/trophygonzales',
        whatsappUrl: 'https://wa.me/553492354877',
        whatsappPhone: '+55 34 9235-4877',
    },
    'clothing-bodybuilding': {
        id: 'clothing-bodybuilding',
        title: 'Clothing',
        subtitle: 'A marca que veste o atleta e o amante do esporte',
        heroBanner: '',
        heroVideo: '',
        secondaryVideo: '',
        mission: 'Desenvolver roupas fitness que sejam tão funcionais quanto estilísticas, para ajudar você a se sentir bem e se apresentar bem, dentro e fora da academia.',
        vision: 'Ser reconhecida como a marca que veste o atleta e o amante do esporte como o conforto e qualidade, levando satisfação a todos os clientes, de acordo com a Clothing Bodybuilding.',
        values: 'Gratidão, Excelência, Audácia, Inovação, Qualidade, Paixão pelo Bodybuilding.',
        historyTitle: 'Sobre a Clothing Bodybuilding',
        historyText: 'A Clothing Bodybuilding produz linhas de vestuário fitness pensadas para o físico de atletas. Modelagens anatômicas, tecidos com alta respirabilidade e visual imponente.',
        instagramUrl: 'https://www.instagram.com/clothingbodybuilding?utm_source=qr&igsh=MXZobjVydnA4cGJ3bg==',
        whatsappUrl: 'https://wa.me/553492510023',
        whatsappPhone: '+55 34 9251-0023',
    },
    'muscle-tan': {
        id: 'muscle-tan',
        title: 'Muscle Tan',
        subtitle: 'Dominando o padrão de pintura no fisiculturismo.',
        heroBanner: '',
        heroVideo: '',
        secondaryVideo: '',
        mission: 'Entregar resultado de palco com padrão profissional e mentalidade de campeão.',
        vision: 'Dominar o padrão de pintura no fisiculturismo mundial.',
        values: 'Profissionalismo, Excelência, Resultado, Mentalidade de Campeão.',
        historyTitle: 'A História da Muscle Tan',
        historyText: `A Muscle Tan nasceu em 2021 para fazer o que ninguém estava fazendo: dominar o padrão de pintura no fisiculturismo.

Sem espaço pra amadorismo. Sem meia qualidade. Desde o primeiro atendimento, a missão sempre foi uma só: entregar resultado de palco.

Em pouco tempo, o nome Muscle Tan saiu do zero e passou a estar nos maiores campeonatos, ao lado dos atletas que sobem pra vencer. Cada aplicação, cada detalhe, cada finalização… construída com padrão profissional e mentalidade de campeão.

Hoje, em 2026, não somos só mais uma marca.
Somos referência. Somos escolha dos atletas que querem destaque real no palco.

E agora com um grande marco na sua história, marcando presença eventos do ZEUS EVOLUTION, seguimos fortalecendo essa missão, elevando o nível do fisiculturismo.

Muscle Tan não é tendência.
É padrão.`,
        instagramUrl: 'https://www.instagram.com/muscletan_',
        whatsappUrl: 'https://wa.me/5513974223326',
        whatsappPhone: '+55 13 97422-3326',
    }
};

let siteSettingTableChecked = false;
async function ensureSiteSettingTable() {
    if (siteSettingTableChecked) return;
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "SiteSetting" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "title" TEXT NOT NULL DEFAULT 'Zeus Evolution',
                "subtitle" TEXT NOT NULL DEFAULT 'Expo Fitness e Campeonato de Fisiculturismo',
                "heroBanner" TEXT,
                "heroVideo" TEXT,
                "secondaryVideo" TEXT,
                "mission" TEXT,
                "vision" TEXT,
                "values" TEXT,
                "historyTitle" TEXT DEFAULT 'A História do Zeus Evolution',
                "historyText" TEXT,
                "instagramUrl" TEXT DEFAULT 'https://www.instagram.com/zeusevolutioncb?igsh=MWR1Y25lZWo1NDM3bw==',
                "whatsappUrl" TEXT DEFAULT 'https://wa.me/553492440149',
                "whatsappPhone" TEXT DEFAULT '+55 34 9244-0149',
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "instructionImages" TEXT;
        `);
        siteSettingTableChecked = true;
    } catch (e: any) {
        console.warn('[SiteSetting] ensureSiteSettingTable check:', e?.message || e);
    }
}

function parseInstructions(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function formatSettingOutput(item: any) {
    if (!item) return item;
    return {
        ...item,
        instructionImages: parseInstructions(item.instructionImages)
    };
}

export class SiteSettingController {
    static async getInstructions(req: Request, res: Response) {
        try {
            await ensureSiteSettingTable();
            const setting = await prisma.siteSetting.findUnique({
                where: { id: 'default' }
            });
            const images = parseInstructions(setting?.instructionImages);
            res.json({ images });
        } catch (e: any) {
            console.error('[SiteSettings] Erro ao buscar instruções:', e);
            res.json({ images: [] });
        }
    }

    static async updateInstructions(req: Request, res: Response) {
        try {
            await ensureSiteSettingTable();
            const { images } = req.body;
            const imagesArray = Array.isArray(images) ? images : [];
            const jsonStr = JSON.stringify(imagesArray);

            const updated = await prisma.siteSetting.upsert({
                where: { id: 'default' },
                create: {
                    id: 'default',
                    title: 'Zeus Evolution',
                    instructionImages: jsonStr
                },
                update: {
                    instructionImages: jsonStr
                }
            });

            res.json({ success: true, images: parseInstructions(updated.instructionImages) });
        } catch (e: any) {
            console.error('[SiteSettings] Erro ao salvar instruções:', e);
            res.status(500).json({ error: 'Erro ao salvar instruções do evento' });
        }
    }

    static async getSettings(req: Request, res: Response) {
        try {
            await ensureSiteSettingTable();
            const pageId = (req.params.page || req.query.page || '') as string;

            if (pageId) {
                const targetId = pageId === 'zeus' ? 'default' : pageId;
                const setting = await prisma.siteSetting.findUnique({
                    where: { id: targetId }
                });

                const fallback = defaultSettingsByPage[targetId] || defaultSettingsByPage.default;
                return res.json(formatSettingOutput({
                    ...fallback,
                    ...(setting || {}),
                    id: targetId
                }));
            }

            // Fetch all settings from DB
            const allDbSettings = await prisma.siteSetting.findMany();
            const dbMap = new Map<string, any>();
            allDbSettings.forEach(s => dbMap.set(s.id, s));

            const pages: Record<string, any> = {};
            for (const [key, defaults] of Object.entries(defaultSettingsByPage)) {
                pages[key] = formatSettingOutput({
                    ...defaults,
                    ...(dbMap.get(key) || {}),
                    id: key
                });
            }

            // Backwards compatibility: root properties match "default" page
            const defaultPage = pages.default;
            res.json({
                ...defaultPage,
                pages
            });
        } catch (error) {
            console.error('[SiteSettings] Erro ao buscar configurações:', error);
            res.json({
                ...defaultSettingsByPage.default,
                instructionImages: [],
                pages: defaultSettingsByPage
            });
        }
    }

    static async updateSettings(req: Request, res: Response) {
        try {
            await ensureSiteSettingTable();
            const data = req.body || {};
            const rawPageId = (req.params.page || req.query.page || data.page || 'default') as string;
            const targetId = rawPageId === 'zeus' ? 'default' : rawPageId;

            const fallback = defaultSettingsByPage[targetId] || defaultSettingsByPage.default;

            let instructionImagesStr: string | null = null;
            if (data.instructionImages !== undefined) {
                instructionImagesStr = Array.isArray(data.instructionImages)
                    ? JSON.stringify(data.instructionImages)
                    : (typeof data.instructionImages === 'string' ? data.instructionImages : '[]');
            }

            const cleanCreateData: any = {
                title: data.title ?? fallback.title ?? 'Zeus Evolution',
                subtitle: data.subtitle ?? fallback.subtitle ?? '',
                heroBanner: data.heroBanner ?? fallback.heroBanner ?? null,
                heroVideo: data.heroVideo ?? fallback.heroVideo ?? null,
                secondaryVideo: data.secondaryVideo ?? fallback.secondaryVideo ?? null,
                mission: data.mission ?? fallback.mission ?? null,
                vision: data.vision ?? fallback.vision ?? null,
                values: data.values ?? fallback.values ?? null,
                historyTitle: data.historyTitle ?? fallback.historyTitle ?? 'A História do Zeus Evolution',
                historyText: data.historyText ?? fallback.historyText ?? null,
                instagramUrl: data.instagramUrl ?? fallback.instagramUrl ?? 'https://www.instagram.com/zeusevolutioncb?igsh=MWR1Y25lZWo1NDM3bw==',
                whatsappUrl: data.whatsappUrl ?? fallback.whatsappUrl ?? 'https://wa.me/553492440149',
                whatsappPhone: data.whatsappPhone ?? fallback.whatsappPhone ?? '+55 34 9244-0149',
            };
            if (instructionImagesStr !== null) {
                cleanCreateData.instructionImages = instructionImagesStr;
            }

            const updated = await prisma.siteSetting.upsert({
                where: { id: targetId },
                create: {
                    id: targetId,
                    ...cleanCreateData
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
                    ...(instructionImagesStr !== null && { instructionImages: instructionImagesStr }),
                }
            });

            res.json(formatSettingOutput(updated));
        } catch (error: any) {
            console.error('[SiteSettings] Erro ao atualizar configurações:', error);
            res.status(500).json({ error: error?.message || 'Erro ao atualizar configurações do site' });
        }
    }
}
