import nodemailer from 'nodemailer';

export class EmailService {
    private static transporter = nodemailer.createTransport({
        service: 'gmail', // You can change this to your email provider
        auth: {
            user: process.env.EMAIL_USER || 'zapliderdigital@gmail.com', // To be configured in .env
            pass: process.env.EMAIL_PASS || 'mjgb gitw myhl lrtx'            // To be configured in .env
        }
    });

    static async sendTicketEmail(to: string, userName: string, championshipName: string, pdfBuffer: Buffer, wonTshirt: boolean = false) {
        const mailOptions = {
            from: `"Zeus Evolution" <${process.env.EMAIL_USER || 'no-reply@zeusevolution.com.br'}>`,
            to,
            subject: wonTshirt 
                ? `PARABÉNS! Você ganhou uma camiseta + Seu Ingresso para ${championshipName}`
                : `Seu Ingresso para ${championshipName} - Zeus Evolution`,
            text: `Olá ${userName},\n\n${wonTshirt ? 'BOAS NOTÍCIAS! Você foi um dos primeiros inscritos e GANHOU UMA CAMISETA OFICIAL do evento!\n\n' : ''}Seu ingresso para o evento ${championshipName} foi gerado com sucesso!\n\nPor favor, encontre-o em anexo. Apresente o QRCode na entrada do evento.\n\nAtenciosamente,\nEquipe Zeus Evolution`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #D4AF37; margin: 0;">Zeus Evolution</h2>
                    </div>

                    ${wonTshirt ? `
                    <div style="background-color: #D4AF37; color: #000; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; text-transform: uppercase; font-weight: 900;">🎁 VOCÊ FOI PREMIADO! 🎁</h3>
                        <p style="margin: 5px 0 0 0; font-size: 14px;">Parabéns! Você foi um dos primeiros inscritos e <strong>ganhou uma Camiseta Oficial</strong> do evento.</p>
                        <p style="margin: 5px 0 0 0; font-size: 12px; font-style: italic;">Apresente este e-mail ou seu documento na recepção para retirar seu brinde.</p>
                    </div>
                    ` : ''}

                    <p>Olá <strong>${userName}</strong>,</p>
                    <p>Seu ingresso para o evento <strong>${championshipName}</strong> foi gerado com sucesso!</p>
                    <p>Encontre-o no arquivo PDF em anexo. Você pode baixar, imprimir, ou simplesmente apresentar o QRCode na tela do seu celular na portaria do evento.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #777; text-align: center;">Atenciosamente,<br>Equipe Zeus Evolution</p>
                </div>
            `,
            attachments: [
                {
                    filename: `ingresso-${championshipName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Ticket email sent: %s', info.messageId);
            return true;
        } catch (error) {
            console.error('Error sending ticket email:', error);
            return false;
        }
    }

    static async sendPasswordResetEmail(to: string, userName: string, resetLink: string) {
        const mailOptions = {
            from: `"Zeus Evolution" <${process.env.EMAIL_USER || 'no-reply@zeusevolution.com.br'}>`,
            to,
            subject: 'Recuperação de Senha - Zeus Evolution',
            text: `Olá ${userName},\n\nVocê solicitou a recuperação de sua senha. Clique no link abaixo para redefini-la:\n\n${resetLink}\n\nO link é válido por 1 hora.\n\nSe você não solicitou isso, ignore este e-mail.\n\nAtenciosamente,\nEquipe Zeus Evolution`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #D4AF37; margin: 0;">Zeus Evolution</h2>
                    </div>
                    <p>Olá <strong>${userName}</strong>,</p>
                    <p>Você solicitou a recuperação de sua senha no sistema Zeus Evolution.</p>
                    <p>Para definir uma nova senha, clique no botão abaixo:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #D4AF37; color: #000; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; text-transform: uppercase;">Redefinir Senha</a>
                    </div>
                    <p style="font-size: 14px; color: #555;">Este link é válido por <strong>1 hora</strong>. Se você não solicitou a alteração, sinta-se à vontade para ignorar este e-mail.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #777; text-align: center;">Atenciosamente,<br>Equipe Zeus Evolution</p>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending reset email:', error);
            return false;
        }
    }
}
