import { prisma } from '../prisma';
import { PdfService } from './pdf.service';
import { EmailService } from './email.service';

export class TicketService {
    static async generateAndSendTicket(ticketId: string) {
        try {
            const ticket = await prisma.ticket.findUnique({
                where: { id: ticketId },
                include: {
                    order: {
                        include: {
                            user: true,
                            championship: true
                        }
                    }
                }
            });

            if (!ticket) {
                console.error(`[TicketService] Ticket ${ticketId} not found.`);
                return;
            }

            const { order } = ticket;
            const { user, championship } = order;

            if (!championship) {
                console.error(`[TicketService] Attempted to generate ticket for order ${order.id} without championship.`);
                return;
            }

            const ticketData = {
                championshipName: championship.name,
                ticketType: order.type === 'COMPETITOR' ? 'Competidor' : 'Espectador',
                eventDate: championship.date,
                eventLocation: championship.location,
                userName: user.name,
                purchaseDate: ticket.createdAt,
                uuid: ticket.uuid
            };

            const pdfBuffer = await PdfService.generateTicketPdf(ticketData);

            await EmailService.sendTicketEmail(
                user.email,
                user.name,
                championship.name,
                pdfBuffer,
                order.wonTshirt
            );

            console.log(`[TicketService] PDF generated and email sent for ticket ${ticketId}.`);

            return pdfBuffer;

        } catch (error) {
            console.error(`[TicketService] Error generating/sending ticket ${ticketId}:`, error);
        }
    }
}
