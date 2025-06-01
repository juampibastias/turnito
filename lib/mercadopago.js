import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

export const createPreference = async (items, metadata) => {
    const preference = new Preference(client);

    const preferenceData = {
        items: items,
        back_urls: {
            success: `${process.env.NEXTAUTH_URL}/booking/success`,
            failure: `${process.env.NEXTAUTH_URL}/booking/failure`,
            pending: `${process.env.NEXTAUTH_URL}/booking/pending`,
        },
        auto_return: 'approved',
        metadata: metadata,
    };

    return await preference.create({ body: preferenceData });
};
