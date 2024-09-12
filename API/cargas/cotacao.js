import fetch from 'node-fetch'; 
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { createDbClient } from "../db/db.js";

export const buscarCotacao = async (req, res) => {
    const db = createDbClient();
    const { salvarNoBanco = false, enviarEmail = false } = req.body;

    const dataAtual = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).split('/').join('-');

    const dataAnterior = getPreviousBusinessDay();

    const urlAtual = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataAtual}'&$top=100&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    const urlAnterior = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataAnterior}'&$top=100&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    try {        
        await db.connect();
        const [responseAtual, responseAnterior] = await Promise.all([fetch(urlAtual), fetch(urlAnterior)]);
        
        if (!responseAtual.ok) {
            throw new Error('Erro ao buscar os dados da cotação atual. Status da resposta: ' + responseAtual.status);
        }

        const jsonDataAtual = await responseAtual.json();
        const jsonDataAnterior = await responseAnterior.json();

        if (salvarNoBanco) {
            if (jsonDataAtual.value.length > 0) {
                const atual = jsonDataAtual.value[0];
                await salvarCotacao(req.user.userId, 'Atual', atual.dataHoraCotacao, atual.cotacaoCompra, atual.cotacaoVenda, enviarEmail);
            } else {
                await salvarCotacao(req.user.userId, 'Atual', '', '', '', enviarEmail);
            }

            if (jsonDataAnterior.value.length > 0) {
                const anterior = jsonDataAnterior.value[0];
                await salvarCotacao(req.user.userId, 'Anterior', anterior.dataHoraCotacao, anterior.cotacaoCompra, anterior.cotacaoVenda, enviarEmail);
            } else {
                await salvarCotacao(req.user.userId, 'Anterior', '', '', '', enviarEmail);
            }
        }

        const dadosSalvos = { atual: jsonDataAtual, anterior: jsonDataAnterior };

        return dadosSalvos;
    } catch (error) {
        console.error('Erro ao buscar cotação:', error);
        throw new Error('Erro ao buscar cotação: ' + error.message);
    } finally {
        await db.end();
    }
};

export const buscarCotacaoAuto = async () => {
    const db = createDbClient();

    const dataAtual = new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).split('/').join('-');

    const dataAnterior = getPreviousBusinessDay();

    const urlAtual = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataAtual}'&$top=100&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    const urlAnterior = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataAnterior}'&$top=100&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    try {
        await db.connect();
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
        console.error('Erro ao buscar cotação automática:', error);
        const query = `SELECT * FROM cotacao WHERE nome IN ('Atual', 'Anterior') ORDER BY dataHoraCotacao DESC LIMIT 2`;
        const result = await db.query(query);

        const cotacoes = result.rows.reduce((acc, row) => {
            acc[row.nome.toLowerCase()] = row;
            return acc;
        }, {});

        if (Object.keys(cotacoes).length > 0) {
            return { atual: cotacoes.atual || {}, anterior: cotacoes.anterior || {} };
        } else {
            throw new Error('Nenhuma cotação anterior encontrada no banco de dados.');
        }
    } finally {
        await db.end();
    }
};

export const salvarCotacao = async (userId, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda, enviarEmail) => {
    const db = createDbClient();
    try {
        await db.connect();
        const checkQuery = `
            SELECT * FROM cotacao
            WHERE user_id = $1 AND nome = $2;
        `;
        const checkValues = [userId, nome];
        const checkResult = await db.query(checkQuery, checkValues);

        if (checkResult.rows.length > 0) {
            const updateQuery = `
                UPDATE cotacao 
                SET dataHoraCotacao = $1, cotacaoCompra = $2, cotacaoVenda = $3, enviarEmail = $6
                WHERE user_id = $4 AND nome = $5;
            `;
            const updateValues = [dataHoraCotacao, cotacaoCompra, cotacaoVenda, userId, nome, enviarEmail];

            await db.query(updateQuery, updateValues);

        } else {
            const insertQuery = `
                INSERT INTO cotacao (user_id, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda, enviarEmail)
                VALUES ($1, $2, $3, $4, $5, $6)
            `;
            const values = [userId, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda, enviarEmail];

            await db.query(insertQuery, values);

        }
    } catch (error) {
        console.error('Erro ao salvar cotação:', error);
        throw new Error('Erro ao salvar cotação: ' + error.message);
    } finally {
        await db.end();
    }
};

export const getAllCotacao = async (userId) => {
    const db = createDbClient();
    try {
        await db.connect();
        const query = `
            SELECT * FROM cotacao
            WHERE user_id = $1
        `;
        const result = await db.query(query, [userId]);
        return result.rows;
    } catch (error) {
        console.error('Erro ao obter cotações salvas:', error);
        throw new Error('Erro ao obter cotações salvas: ' + error.message);
    } finally {
        await db.end();
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
        throw new Error('Erro ao enviar e-mail: ' + error.message);
    }
};

export const updateSaveCotacao = async () => {
    const db = createDbClient();
    try {
        await db.connect();
        const selectQuery = `
                SELECT co.*, u.email FROM cotacao co JOIN users u ON co.user_id = u.id WHERE co.nome = 'Atual' AND co.enviaremail = true
        `;
        
        const { rows } = await db.query(selectQuery);
        
        if (rows && rows.length > 0) {
            for (const row of rows) {
                try {
                    const { atual, anterior } = await buscarCotacaoAuto();
                    
                    if (atual.value.length > 0) { 
                        const cotacaoAtual = atual.value[0];
                        const userId = row.user_id;
                    
                        await salvarCotacao(userId, 'Atual', cotacaoAtual.dataHoraCotacao, cotacaoAtual.cotacaoCompra, cotacaoAtual.cotacaoVenda, 'true');
                     
                        if (cotacaoAtual.dataHoraCotacao !== row.datahoracotacao) {
                            const destinatario = row.email;
                            const assunto = 'Atualização de Cotação';
                            const corpo = `
                                <p>Olá,</p>
                                <p>A cotação foi atualizada com sucesso para o seu usuário.</p>
                                <p>Segue abaixo os detalhes da cotação atual:</p>
                                <ul>
                                    <li>Data e Hora: ${cotacaoAtual.dataHoraCotacao}</li>
                                    <li>Cotação de Compra: ${cotacaoAtual.cotacaoCompra.toFixed(4).replace('.', ',')}</li>
                                    <li>Cotação de Venda <strong>(PTAX)</strong>: ${cotacaoAtual.cotacaoVenda.toFixed(4).replace('.', ',')}</li>
                                </ul>
                                <p>Atenciosamente,<br/>Sua Aplicação</p>
                            `;
                        
                            await enviarEmail(destinatario, assunto, corpo);
                        }
                    }
                    
                    if (anterior.value.length > 0) {
                        const cotacaoAnterior = anterior.value[0];
                        const userId = row.user_id;
                    
                        await salvarCotacao(userId, 'Anterior', cotacaoAnterior.dataHoraCotacao, cotacaoAnterior.cotacaoCompra, cotacaoAnterior.cotacaoVenda, 'true');
                    }
                } catch (error) {
                    console.error('Erro ao processar as cotações para o usuário', row.user_id, ':', error.message);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao buscar e atualizar os itens salvos:', error.message);
    } finally {
        await db.end();
    }
};

cron.schedule('*/5 6-18 * * *', async () => {
    await updateSaveCotacao();
}, {
    timezone: 'America/Sao_Paulo'
});

const getPreviousBusinessDay = (baseDate = new Date()) => {
    let previousDate = new Date(baseDate.getTime() - 86400000); 
    let day = previousDate.getDay();

    if (day === 0) {
        previousDate.setDate(previousDate.getDate() - 2);
    } 
    else if (day === 6) {
        previousDate.setDate(previousDate.getDate() - 1);
    }

    return previousDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).split('/').join('-');
}
