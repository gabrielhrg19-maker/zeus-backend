import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        const payload = {
            transaction_amount: 1,
            token: "515e6d3e62439c2404afef0bc2542015",
            description: "Pagamento Pedido 0968e58e-48fc-416a-8a23-2f8fb783698a",
            installments: 1,
            payment_method_id: "master",
            payer: {
                email: "fcarmo072@gmail.com",
                first_name: "Cliente",
                last_name: "Evolução",
                identification: {
                    type: "CPF",
                    number: "15326726670"
                }
            },
            issuer_id: "12518"
        };
        
        console.log("Enviando com issuer_id string...");

        const res = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': Date.now().toString()
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("Resposta MP (String):", JSON.stringify(data, null, 2));

        // Teste 2 omitindo issuer_id se falhar
        if (data.status === 400 || data.cause?.length > 0) {
            console.log("Testando com issuer_id omitido...");
            delete payload.issuer_id;
            const res2 = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': Date.now().toString() + "v2"
                },
                body: JSON.stringify(payload)
            });
            console.log("Resposta MP (Omitido):", JSON.stringify(await res2.json(), null, 2));
        }

    } catch (e: any) {
        console.error("Erro Fatal:", e.message);
    }
}
main();
