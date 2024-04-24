import { db } from "../db/db.js";
import cron from 'node-cron';

const buscarEAtualizarCotacao = async () => {
    try {
        await buscarCotacao({ user: { userId: 'seu_user_id' } }, true);
        console.log('Cotação atualizada com sucesso.');
    } catch (error) {
        console.error('Erro ao atualizar a cotação:', error.message);
    }
};

cron.schedule('10 12,16 * * *', async () => {
    await buscarEAtualizarCotacao();
}, {
    timezone: 'America/Sao_Paulo'
});

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

export const salvarCotacao = async (userId, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda) => {
    try {
        const checkQuery = `
            SELECT * FROM cotacao 
            WHERE user_id = $1 AND nome = $2;
        `;
        const checkValues = [userId, nome];
        const checkResult = await db.query(checkQuery, checkValues);

        if (checkResult.rows.length > 0) {
            const updateQuery = `
                UPDATE cotacao 
                SET dataHoraCotacao = $1, cotacaoCompra = $2, cotacaoVenda = $3
                WHERE user_id = $4 AND nome = $5
                RETURNING *;
            `;
            const updateValues = [dataHoraCotacao, cotacaoCompra, cotacaoVenda, userId, nome];
            const updateResult = await db.query(updateQuery, updateValues);
            return updateResult.rows[0];
        } else {
            const insertQuery = `
                INSERT INTO cotacao (user_id, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;
            const insertValues = [userId, nome, dataHoraCotacao, cotacaoCompra, cotacaoVenda];
            const insertResult = await db.query(insertQuery, insertValues);
            return insertResult.rows[0];
        }
    } catch (error) {
        throw new Error('Erro ao salvar/atualizar a cotação no banco de dados: ' + error.message);
    }
};
