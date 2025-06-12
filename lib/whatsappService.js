// lib/whatsappService.js
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Genera el mensaje de confirmación de turno
 */
export function generateConfirmationMessage(appointment) {
    const date = format(
        new Date(appointment.appointmentDate),
        "EEEE d 'de' MMMM 'de' yyyy",
        { locale: es }
    );
    const zones = appointment.selectedZones.map((z) => z.name).join(', ');

    return `🎉 *¡Tu turno está confirmado!*

👤 *Cliente:* ${appointment.clientName} ${appointment.clientLastName}
📅 *Fecha:* ${date}
🕐 *Horario:* ${appointment.timeSlot.start} - ${appointment.timeSlot.end}
💆‍♀️ *Zonas:* ${zones}
💰 *Total:* $${appointment.totalPrice}
✅ *Seña pagada:* $${appointment.depositAmount || appointment.totalPrice * 0.5}

📝 *Detalles importantes:*
• Llega 5-10 minutos antes de tu turno
• El resto del pago se realiza el día del turno
• Para cancelaciones, mínimo 36hs de anticipación

📞 Si tienes dudas, contáctanos por este mismo WhatsApp.

¡Te esperamos! 💕`;
}

/**
 * Envía un mensaje de WhatsApp usando la API gratuita de CallMeBot
 * Nota: Este servicio requiere configuración previa del número
 */
export async function sendWhatsAppViaCallMeBot(phoneNumber, message) {
    try {
        // CallMeBot API - Servicio gratuito (requiere registrar el número previamente)
        const apiKey = process.env.CALLMEBOT_API_KEY;

        if (!apiKey) {
            console.warn('CALLMEBOT_API_KEY no configurada');
            return { success: false, error: 'API key no configurada' };
        }

        const encodedMessage = encodeURIComponent(message);
        const url = `https://api.callmebot.com/whatsapp.php?phone=${phoneNumber}&text=${encodedMessage}&apikey=${apiKey}`;

        const response = await fetch(url);
        const text = await response.text();

        if (response.ok) {
            console.log(`✅ WhatsApp enviado a ${phoneNumber}`);
            return { success: true, response: text };
        } else {
            console.error(`❌ Error enviando WhatsApp: ${text}`);
            return { success: false, error: text };
        }
    } catch (error) {
        console.error('Error en sendWhatsAppViaCallMeBot:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Usa Twilio para envío de WhatsApp (opción de pago pero más confiable)
 */
export async function sendWhatsAppViaTwilio(phoneNumber, message) {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // Formato: whatsapp:+14155238886

        if (!accountSid || !authToken || !fromNumber) {
            console.warn('Credenciales de Twilio no configuradas');
            return { success: false, error: 'Credenciales no configuradas' };
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        const params = new URLSearchParams();
        params.append('From', fromNumber);
        params.append('To', `whatsapp:+${phoneNumber}`);
        params.append('Body', message);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization:
                    'Basic ' +
                    Buffer.from(`${accountSid}:${authToken}`).toString(
                        'base64'
                    ),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const data = await response.json();

        if (response.ok) {
            console.log(
                `✅ WhatsApp enviado via Twilio a ${phoneNumber}:`,
                data.sid
            );
            return { success: true, response: data };
        } else {
            console.error(`❌ Error Twilio: ${data.message}`);
            return { success: false, error: data.message };
        }
    } catch (error) {
        console.error('Error en sendWhatsAppViaTwilio:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Alternativa usando Baileys (librería gratuita de WhatsApp)
 * Requiere configuración más compleja pero es completamente gratuita
 */
export async function sendWhatsAppViaBaileys(phoneNumber, message) {
    // Esta implementación requiere Baileys y es más compleja
    // Por ahora, devolvemos un placeholder
    console.log('📱 Baileys WhatsApp service no implementado aún');
    return { success: false, error: 'Servicio no implementado' };
}

/**
 * Función principal que intenta diferentes métodos de envío
 */
export async function sendConfirmationWhatsApp(appointment) {
    const message = generateConfirmationMessage(appointment);
    const phoneNumber = appointment.clientPhone;

    console.log(`📱 Enviando WhatsApp de confirmación a ${phoneNumber}`);

    // Intentar con CallMeBot primero (gratuito)
    let result = await sendWhatsAppViaCallMeBot(phoneNumber, message);

    if (result.success) {
        return { success: true, method: 'CallMeBot', ...result };
    }

    // Si falla CallMeBot, intentar con Twilio
    result = await sendWhatsAppViaTwilio(phoneNumber, message);

    if (result.success) {
        return { success: true, method: 'Twilio', ...result };
    }

    // Si ambos fallan, loguear para envío manual
    console.log(`📝 Mensaje para envío manual a ${phoneNumber}:`);
    console.log(message);

    return {
        success: false,
        method: 'Manual',
        message:
            'No se pudo enviar automáticamente. Revisar logs para envío manual.',
        phoneNumber,
        messageContent: message,
    };
}
