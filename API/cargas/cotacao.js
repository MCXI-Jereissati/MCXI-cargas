import { db } from "../db/db.js";
import fetch from 'node-fetch'; 
import cron from 'node-cron';
import nodemailer from 'nodemailer';


export const buscarCotacao = async (req) => {
    const { salvarNoBanco = false } = req.body;

    const dataAtual = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).split('/').join('-');

    const dataAnterior = new Date(Date.now() - 86400000).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).split('/').join('-');

    const urlAtual = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataAtual}'&$top=100&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    const urlAnterior = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataAnterior}'&$top=100&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    try {
        const [responseAtual, responseAnterior] = await Promise.all([fetch(urlAtual), fetch(urlAnterior)]);
        
        if (!responseAtual.ok) {
            throw new Error('Erro ao buscar os dados da cotação atual. Status da resposta: ' + responseAtual.status);
        }

        if (!responseAnterior.ok) {
            throw new Error('Erro ao buscar os dados da cotação anterior. Status da resposta: ' + responseAnterior.status);
        }

        const jsonDataAtual = await responseAtual.json();
        const jsonDataAnterior = await responseAnterior.json();

        if (salvarNoBanco) {
            if (jsonDataAtual.value.length > 0 && jsonDataAnterior.value.length > 0) {
                const atual = jsonDataAtual.value[0];
                const anterior = jsonDataAnterior.value[0];
                
                await Promise.all([
                    salvarCotacao(req.user.userId, 'Atual', atual.dataHoraCotacao, atual.cotacaoCompra, atual.cotacaoVenda),
                    salvarCotacao(req.user.userId, 'Anterior', anterior.dataHoraCotacao, anterior.cotacaoCompra, anterior.cotacaoVenda)
                ]);
            } else {
                throw new Error('Valores das cotações estão vazios ou indefinidos.');
            }
        }

        return { atual: jsonDataAtual, anterior: jsonDataAnterior };
    } catch (error) {
        throw new Error(error.message);
    }
};

export const buscarCotacaoAuto = async (req) => {

    const dataAtual = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).split('/').join('-');

    const dataAnterior = new Date(Date.now() - 86400000).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).split('/').join('-');

    const urlAtual = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataAtual}'&$top=100&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    const urlAnterior = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataAnterior}'&$top=100&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    try {
        const [responseAtual, responseAnterior] = await Promise.all([fetch(urlAtual), fetch(urlAnterior)]);
        
        if (!responseAtual.ok) {
            throw new Error('Erro ao buscar os dados da cotação atual. Status da resposta: ' + responseAtual.status);
        }

        if (!responseAnterior.ok) {
            throw new Error('Erro ao buscar os dados da cotação anterior. Status da resposta: ' + responseAnterior.status);
        }

        const jsonDataAtual = await responseAtual.json();
        const jsonDataAnterior = await responseAnterior.json();

        return { atual: jsonDataAtual, anterior: jsonDataAnterior };
    } catch (error) {
        throw new Error(error.message);
    }
};

export const salvarCotacao = async (userId, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda) => {
    try {
        const checkQuery = `
            SELECT * FROM cotacao
            WHERE user_id = $1 AND nome = $2;
        `;
        const checkValues = [userId, nome];
        const checkResult = await db.query(checkQuery, checkValues);
        const enviarEmail = 'true';

        if (checkResult.rows.length > 0) {
            const updateQuery = `
                UPDATE cotacao 
                SET dataHoraCotacao = $1, cotacaoCompra = $2, cotacaoVenda = $3
                WHERE user_id = $4 AND nome = $5;
            `;
            const updateValues = [dataHoraCotacao, cotacaoCompra, cotacaoVenda, userId, nome];

            await db.query(updateQuery, updateValues);

            console.log('Os dados da cotação foram atualizados para o usuário', userId);
        } else {
            const insertQuery = `
                INSERT INTO cotacao (user_id, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda, enviaremail)
                VALUES ($1, $2, $3, $4, $5, $6)
            `;
            const values = [userId, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda, enviarEmail];

            await db.query(insertQuery, values);

            console.log('Os dados da cotação foram salvos para o usuário', userId);
        }
    } catch (error) {
        throw new Error(error.message);
    }
};

export const getCotacaoById = async (userId) => {
    try {
        const query = `
            SELECT * FROM cotacao
            WHERE user_id = $1
        `;
        const result = await db.query(query, [userId]);
        return result.rows[0];
    } catch (error) {
        throw new Error('Erro ao buscar cotações por dia: ' + error.message);
    }
};

export const deleteCotacaoById = async (userId) => {
    try {
        const query = `
            DELETE FROM cotacao
            WHERE user_id = $1
        `;
        const result = await db.query(query, [userId]);
        return result.rows[0];
    } catch (error) {
        throw new Error('Erro ao deletar cotação: ' + error.message);
    }
};


export const enviarEmail = async (destinatario, assunto, corpo) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'redefinirsenha1983@gmail.com',
            pass: 'vtaysanamhtagphi'
        }
    });

    const mailOptions = {
        from: 'redefinirsenha1983@gmail.com',
        to: destinatario,
        subject: assunto,
        html: corpo
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('E-mail enviado com sucesso para', destinatario);
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
    }
};

export const updateSaveCotacao = async () => {
    try {
        const selectQuery = `
            SELECT co.*, u.email FROM cotacao co JOIN users u ON co.user_id = u.id
        `;
        
        const { rows } = await db.query(selectQuery);
        
        if (rows && rows.length > 0) {
            let atualizacaoEnviada = false;
            for (const row of rows) {
                try {
                    const { atual, anterior } = await buscarCotacaoAuto();
                    
                    if (atual.value.length > 0) { 
                        const cotacaoAtual = atual.value[0];
                        const userId = row.user_id;
                    
                        await salvarCotacao(userId, 'Atual', cotacaoAtual.dataHoraCotacao, cotacaoAtual.cotacaoCompra, cotacaoAtual.cotacaoVenda);
                    
                        console.log('Cotação atualizada com sucesso para o usuário', userId);
                    
                        if (row.enviarEmail) {
                            const destinatario = row.email;
                            const assunto = 'Atualização de Cotação';
                            const corpo = `
                                <p>Olá,</p>
                                <p>A cotação foi atualizada com sucesso para o seu usuário.</p>
                                <p>Segue abaixo os detalhes da cotação atual:</p>
                                <ul>
                                    <li>Data e Hora: ${cotacaoAtual.dataHoraCotacao}</li>
                                    <li>Cotação de Compra: ${cotacaoAtual.cotacaoCompra}</li>
                                    <li>Cotação de Venda: ${cotacaoAtual.cotacaoVenda}</li>
                                </ul>
                                <p>Atenciosamente,<br/>Sua Aplicação</p>
                            `;
                        
                            await enviarEmail(destinatario, assunto, corpo);
                            atualizacaoEnviada = true;
                        }
                    }
                    
                    if (anterior.value.length > 0) {
                        const cotacaoAnterior = anterior.value[0];
                        const userId = row.user_id;
                    
                        await salvarCotacao(userId, 'Anterior', cotacaoAnterior.dataHoraCotacao, cotacaoAnterior.cotacaoCompra, cotacaoAnterior.cotacaoVenda);
                    }
                } catch (error) {
                    console.error('Erro ao processar as cotações para o usuário', row.user_id, ':', error.message);
                }
            }
        } else {
            console.log('Não foram encontrados itens salvos na tabela cotacao.');
        }
    } catch (error) {
        console.error('Erro ao buscar e atualizar os itens salvos:', error.message);
    }
};

cron.schedule('10 12,16 * * *', async () => {
    await updateSaveCotacao();
}, {
    timezone: 'America/Sao_Paulo'
});