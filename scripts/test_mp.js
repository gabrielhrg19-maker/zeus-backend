const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
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

    try {
        console.log("Enviando via Axios com issuer_id string...");
        const res = await axios.post('https://api.mercadopago.com/v1/payments', payload, {
            headers: {
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': Date.now().toString()
            }
        });
        console.log("Resposta MP (String):", JSON.stringify(res.data, null, 2));

    } catch (e) {
        if (e.response && (e.response.status === 400 || e.response.data.cause)) {
            console.error("Erro Original (10102 provável):", JSON.stringify(e.response.data, null, 2));
            
            console.log("\n--- Retentativa sem issuer_id ---");
            try {
                const payload2 = { ...payload };
                delete payload2.issuer_id;
                const res2 = await axios.post('https://api.mercadopago.com/v1/payments', payload2, {
                    headers: {
                        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': Date.now().toString() + "v2"
                    }
                });
                console.log("Resposta MP (Omitido):", res2.data.status);
            } catch (e2) {
                console.error("Erro na Retentativa:", e2.response ? JSON.stringify(e2.response.data, null, 2) : e2.message);
            }
            
            console.log("\n--- Retentativa com amount = 5 ---");
            try {
                const payload3 = { ...payload, transaction_amount: 5, issuer_id: "12518" };
                const res3 = await axios.post('https://api.mercadopago.com/v1/payments', payload3, {
                    headers: {
                        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': Date.now().toString() + "v3"
                    }
                });
                console.log("Resposta MP Amount:", res3.data.status);
            } catch (e3) {
                console.error("Erro no Amount:", e3.response ? JSON.stringify(e3.response.data, null, 2) : e3.message);
            }
        }
    }
}
main();
