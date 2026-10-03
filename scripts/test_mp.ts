import { MercadoPagoConfig, Payment } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) return console.log('Sem token');

    const client = new MercadoPagoConfig({ accessToken });
    const paymentClient = new Payment(client);

    try {
        const payload: any = {
            transaction_amount: 1,
            token: '515e6d3e62439c2404afef0bc2542015',
            description: 'Pagamento Pedido 0968e58e-48fc-416a-8a23-2f8fb783698a',
            installments: 1,
            payment_method_id: 'master',
            payer: {
                email: 'fcarmo072@gmail.com',
                first_name: 'Cliente',
                last_name: 'Evolução',
                identification: {
                    type: 'CPF',
                    number: '15326726670'
                }
            },
            issuer_id: '12518'
        };
        const response = await paymentClient.create({ body: payload });
        console.log(response);
    } catch (e: any) {
        console.error("Erro MP:", e.message);
        console.error("Causa:", JSON.stringify(e.cause, null, 2));
    }
}

main();
