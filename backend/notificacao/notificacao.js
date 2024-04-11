const nodemailer = require('nodemailer');

const enviarEmail = async (destinatario, numCodigoAereo) => {
    const transporter = nodemailer.createTransport({
        service: 'seu provedor de e-mail',
        auth: {
            user: 'seu-email@example.com',
            pass: 'sua-senha-de-email'
        }
    });

    const mailOptions = {
        from: 'seu-email@example.com',
        to: destinatario,
        subject: 'Atualização de Carga',
        text: `A carga com o número de código aéreo ${numCodigoAereo} foi atualizada.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('E-mail enviado com sucesso para notificar sobre a atualização da carga:', numCodigoAereo);
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
    }
};

const buscarInfoUsuarioById = async (userId) => {
    try {
        const query = `
            SELECT email FROM users
            WHERE user_id = $1
        `;
        const result = await db.query(query, [userId]);
        return result.rows[0];
    } catch (error) {
        throw new Error('Erro ao buscar email de usuário: ' + error.message);
    }
};
