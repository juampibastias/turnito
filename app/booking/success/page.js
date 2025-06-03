'use client';
import { useEffect, useState } from 'react';

export default function Page({ searchParams }) {
    const payment_id = searchParams.payment_id;
    const status = searchParams.status;

    const [confirming, setConfirming] = useState(false);
    const [pagoConfirmado, setPagoConfirmado] = useState(
        payment_id && status === 'approved'
    );

    useEffect(() => {
        async function confirmPayment() {
            if (payment_id && status === 'approved') {
                setConfirming(true);
                try {
                    const res = await fetch('/api/confirm-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentId: payment_id }),
                    });
                    if (res.ok) {
                        setPagoConfirmado(true);
                    } else {
                        console.error('Payment confirmation failed');
                    }
                } catch (err) {
                    console.error('Error confirming payment:', err);
                } finally {
                    setConfirming(false);
                }
            }
        }
        confirmPayment();
    }, [payment_id, status]);

    return (
        <div className='min-h-screen px-4 py-12 bg-gradient-to-br from-green-50 to-blue-100'>
            <div className='max-w-2xl mx-auto'>
                <div className='overflow-hidden bg-white shadow-2xl rounded-3xl'>
                    <div className='p-8 text-center text-white bg-gradient-to-r from-green-500 to-blue-600'>
                        <div className='flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white rounded-full'>
                            <svg
                                className='w-8 h-8 text-green-500'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M5 13l4 4L19 7'
                                />
                            </svg>
                        </div>
                        <h1 className='mb-2 text-3xl font-bold'>
                            ¡Reserva Confirmada!
                        </h1>
                        <p className='text-green-100'>
                            {pagoConfirmado
                                ? 'Tu turno ha sido reservado exitosamente'
                                : 'No se pudo verificar el pago'}
                        </p>
                    </div>

                    <div className='p-8'>
                        <div className='mb-8 text-center'>
                            <h2 className='mb-4 text-2xl font-semibold text-gray-800'>
                                Detalles de tu reserva
                            </h2>
                            <div className='p-6 text-left rounded-lg bg-gray-50'>
                                <p className='mb-2'>
                                    <strong>Estado del pago:</strong>{' '}
                                    {pagoConfirmado ? 'Confirmado' : 'Error'}
                                </p>
                                <p className='mb-2'>
                                    <strong>Seña pagada:</strong> 50% del total
                                </p>
                                <p className='mb-4'>
                                    <strong>Saldo restante:</strong> Se abona el
                                    día del turno
                                </p>

                                <div className='pt-4 border-t'>
                                    <h3 className='mb-2 font-semibold'>
                                        Recordatorios importantes:
                                    </h3>
                                    <ul className='space-y-1 text-sm text-gray-600'>
                                        <li>• Llega 10 minutos antes</li>
                                        <li>
                                            • No usar cremas ni desodorantes
                                        </li>
                                        <li>• Vello de al menos 3mm</li>
                                        <li>• Evitar sol 48hs antes</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className='text-center'>
                            <a
                                href='/'
                                className='inline-block px-8 py-3 font-semibold text-white rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                            >
                                Volver al inicio
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
