'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function BookingSuccess() {
    const router = useRouter();
    const [bookingDetails, setBookingDetails] = useState(null);

    useEffect(() => {
        // En una implementación real, aquí verificarías el pago con MercadoPago
        // y actualizarías el estado del turno en la base de datos
        const { payment_id, status } = router.query;

        if (payment_id && status === 'approved') {
            // Aquí harías una llamada al backend para confirmar el pago
            confirmPayment(payment_id);
        }
    }, [router.query]);

    const confirmPayment = async (paymentId) => {
        try {
            const response = await fetch('/api/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paymentId }),
            });

            if (response.ok) {
                const data = await response.json();
                setBookingDetails(data);
            }
        } catch (error) {
            console.error('Error confirming payment:', error);
        }
    };

    return (
        <div className='min-h-screen bg-gradient-to-br from-green-50 to-blue-100 py-12 px-4'>
            <div className='max-w-2xl mx-auto'>
                <div className='bg-white rounded-3xl shadow-2xl overflow-hidden'>
                    <div className='bg-gradient-to-r from-green-500 to-blue-600 p-8 text-white text-center'>
                        <div className='w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4'>
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
                        <h1 className='text-3xl font-bold mb-2'>
                            ¡Reserva Confirmada!
                        </h1>
                        <p className='text-green-100'>
                            Tu turno ha sido reservado exitosamente
                        </p>
                    </div>

                    <div className='p-8'>
                        <div className='text-center mb-8'>
                            <h2 className='text-2xl font-semibold text-gray-800 mb-4'>
                                Detalles de tu reserva
                            </h2>
                            <div className='bg-gray-50 rounded-lg p-6 text-left'>
                                <p className='mb-2'>
                                    <strong>Estado del pago:</strong> Confirmado
                                </p>
                                <p className='mb-2'>
                                    <strong>Seña pagada:</strong> 50% del total
                                </p>
                                <p className='mb-4'>
                                    <strong>Saldo restante:</strong> Se abona el
                                    día del turno
                                </p>

                                <div className='border-t pt-4'>
                                    <h3 className='font-semibold mb-2'>
                                        Recordatorios importantes:
                                    </h3>
                                    <ul className='text-sm text-gray-600 space-y-1'>
                                        <li>
                                            • Llega 10 minutos antes de tu
                                            horario
                                        </li>
                                        <li>
                                            • No uses cremas ni desodorantes el
                                            día del turno
                                        </li>
                                        <li>
                                            • El vello debe tener al menos 3mm
                                            de largo
                                        </li>
                                        <li>
                                            • Evita la exposición al sol 48hs
                                            antes
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className='text-center'>
                            <button
                                onClick={() => router.push('/')}
                                className='px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 font-semibold'
                            >
                                Volver al inicio
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
