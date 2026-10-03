import { prisma } from '../prisma';

/**
 * Transforma um texto em um slug amigável para URL.
 * Ex.: "Zeus Evolution Uberaba 2026" -> "zeus-evolution-uberaba-2026"
 */
export function slugify(text: string): string {
    return text
        .toString()
        .normalize('NFD') // separa acentos das letras
        .replace(/[\u0300-\u036f]/g, '') // remove os acentos
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-') // troca tudo que não é letra/número por hífen
        .replace(/^-+|-+$/g, ''); // remove hífens das pontas
}

/**
 * Gera um slug único para a tabela Championship.
 * Caso o slug base já exista, adiciona um sufixo numérico (-2, -3, ...).
 */
export async function generateUniqueChampionshipSlug(
    base: string,
    excludeId?: string
): Promise<string> {
    let baseSlug = slugify(base);
    if (!baseSlug) baseSlug = 'evento';

    let candidate = baseSlug;
    let counter = 2;

    while (true) {
        const existing = await prisma.championship.findUnique({
            where: { slug: candidate },
            select: { id: true },
        });

        if (!existing || existing.id === excludeId) {
            return candidate;
        }

        candidate = `${baseSlug}-${counter}`;
        counter += 1;
    }
}
