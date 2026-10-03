import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketData {
    championshipName: string;
    ticketType: string;
    eventDate: Date;
    eventLocation: string;
    userName: string;
    purchaseDate: Date;
    uuid: string;
}

export class PdfService {
    static async generateTicketPdf(data: TicketData): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            try {
                // Generate QR Code Buffer
                const qrCodeDataUrl = await QRCode.toDataURL(data.uuid, { width: 150, margin: 1 });
                const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

                // A "movie ticket" aspect ratio, e.g., 600x250
                const Doc = (PDFDocument as any).default || PDFDocument;
                const doc = new Doc({
                    size: [600, 250],
                    margin: 0
                });

                const buffers: Buffer[] = [];
                doc.on('data', (chunk: any) => buffers.push(chunk));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Background Color
                doc.rect(0, 0, 600, 250).fill('#111111');

                // Ticket Border/Dashend Line Separator
                doc.moveTo(420, 20).lineTo(420, 230).dash(5, { space: 5 }).stroke('#444444');
                doc.undash();

                // Left Side - Event Details
                const champName = data.championshipName || 'Evento Zeus';
                doc.fillColor('#D4AF37') // Gold/Amber color
                    .fontSize(22)
                    .font('Helvetica-Bold')
                    .text(champName.toUpperCase(), 30, 30, { width: 380, align: 'left' });

                const ticketType = data.ticketType || 'Visitante';
                doc.fillColor('#FFFFFF')
                    .fontSize(12)
                    .font('Helvetica')
                    .text(`TIPO: ${ticketType.toUpperCase()}`, 30, 70);

                const formattedEventDate = format(new Date(data.eventDate), "dd/MM/yyyy 'às' HH:mm");
                doc.fillColor('#AAAAAA')
                    .fontSize(10)
                    .text(`Data do Evento: ${formattedEventDate}`, 30, 95);

                const eventLoc = data.eventLocation || 'Local a definir';
                doc.text(`Local: ${eventLoc}`, 30, 115, { width: 370 });

                // Attendee Info
                const userName = data.userName || 'Participante';
                doc.fillColor('#FFFFFF')
                    .fontSize(14)
                    .font('Helvetica-Bold')
                    .text(userName.toUpperCase(), 30, 160);

                const formattedPurchaseDate = format(new Date(data.purchaseDate), "dd/MM/yyyy HH:mm");
                doc.fillColor('#666666')
                    .fontSize(9)
                    .font('Helvetica')
                    .text(`Comprado em: ${formattedPurchaseDate}`, 30, 185);

                doc.text(`ID: ${data.uuid}`, 30, 200, { width: 370 });

                // Right Side - QR Code
                doc.image(qrCodeBuffer, 435, 30, { width: 130 });

                doc.fillColor('#AAAAAA')
                    .fontSize(8)
                    .text('Apresente este código na', 435, 170, { width: 130, align: 'center' })
                    .text('portaria do evento.', 435, 185, { width: 130, align: 'center' });

                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }
}
