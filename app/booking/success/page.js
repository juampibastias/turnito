'use client';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SuccessPage() {
    const [paymentStatus, setPaymentStatus] = useState('loading');
    const [appointmentData, setAppointmentData] = useState(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentId = urlParams.get('payment_id');
        const status = urlParams.get('status');

        if (paymentId && status === 'approved') {
            confirmPayment(paymentId);
        } else if (status) {
            setPaymentStatus(status);
        }
    }, []);

    const confirmPayment = async (paymentId) => {
        try {
            const response = await fetch('/api/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paymentId }),
            });

            const data = await response.json();

            if (response.ok) {
                setPaymentStatus('approved');
                setAppointmentData(data.appointment);
            } else {
                setPaymentStatus('error');
            }
        } catch (error) {
            console.error('Error confirming payment:', error);
            setPaymentStatus('error');
        }
    };

    if (paymentStatus === 'loading') {
        return (
            <div className='flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-100'>
                <div className='text-center'>
                    <div className='w-16 h-16 mx-auto mb-4 border-b-2 border-green-500 rounded-full animate-spin'></div>
                    <p className='text-gray-600'>Verificando el pago...</p>
                </div>
            </div>
        );
    }

    if (paymentStatus === 'approved') {
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
                                ¡Pago Exitoso!
                            </h1>
                            <p className='text-green-100'>
                                Tu turno ha sido confirmado
                            </p>
                        </div>

                        <div className='p-8 text-center'>
                            <h2 className='mb-6 text-2xl font-semibold text-gray-800'>
                                Detalles de tu Reserva
                            </h2>

                            {appointmentData && (
                                <div className='p-6 mb-6 text-left rounded-lg bg-gray-50'>
                                    <div className='grid gap-3'>
                                        <div className='flex justify-between'>
                                            <span className='font-medium'>
                                                Fecha:
                                            </span>
                                            <span>
                                                {format(
                                                    new Date(
                                                        appointmentData.appointmentDate
                                                    ),
                                                    'dd MMM yyyy',
                                                    { locale: es }
                                                )}
                                            </span>
                                        </div>
                                        <div className='flex justify-between'>
                                            <span className='font-medium'>
                                                Horario:
                                            </span>
                                            <span>
                                                {appointmentData.timeSlot.start}{' '}
                                                - {appointmentData.timeSlot.end}
                                            </span>
                                        </div>
                                        <div className='flex justify-between'>
                                            <span className='font-medium'>
                                                Cliente:
                                            </span>
                                            <span>
                                                {appointmentData.clientName}{' '}
                                                {appointmentData.clientLastName}
                                            </span>
                                        </div>
                                        <div className='flex justify-between'>
                                            <span className='font-medium'>
                                                Zonas:
                                            </span>
                                            <span>
                                                {appointmentData.selectedZones
                                                    .map((z) => z.name)
                                                    .join(', ')}
                                            </span>
                                        </div>
                                        <div className='flex justify-between'>
                                            <span className='font-medium'>
                                                Total:
                                            </span>
                                            <span>
                                                ${appointmentData.totalPrice}
                                            </span>
                                        </div>
                                        <div className='flex justify-between text-green-600'>
                                            <span className='font-medium'>
                                                Seña pagada:
                                            </span>
                                            <span>
                                                ${appointmentData.depositAmount}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className='space-y-4'>
                                <div className='p-4 border border-blue-200 rounded-lg bg-blue-50'>
                                    <p className='text-sm text-blue-800'>
                                        <strong>Importante:</strong> Recibirás
                                        un WhatsApp de confirmación. El resto
                                        del pago se realiza el día del turno.
                                    </p>
                                </div>

                                <div className='space-y-3'>
                                    <a
                                        href='/'
                                        className='inline-block w-full px-8 py-3 font-semibold text-white rounded-lg bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700'
                                    >
                                        Volver al inicio
                                    </a>
                                    <a
                                        href='https://wa.me/1234567890'
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='inline-block w-full px-8 py-3 font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600'
                                    >
                                        Contactar por WhatsApp
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Estado de error o pendiente
    return (
        <div className='min-h-screen px-4 py-12 bg-gradient-to-br from-yellow-50 to-orange-100'>
            <div className='max-w-2xl mx-auto'>
                <div className='overflow-hidden bg-white shadow-2xl rounded-3xl'>
                    <div className='p-8 text-center text-white bg-gradient-to-r from-yellow-500 to-orange-600'>
                        <div className='flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white rounded-full'>
                            <svg
                                className='w-8 h-8 text-yellow-500'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z'
                                />
                            </svg>
                        </div>
                        <h1 className='mb-2 text-3xl font-bold'>
                            {paymentStatus === 'pending'
                                ? 'Pago Pendiente'
                                : 'Hubo un problema'}
                        </h1>
                        <p className='text-yellow-100'>
                            {paymentStatus === 'pending'
                                ? 'Tu pago está siendo procesado'
                                : 'No se pudo procesar tu pago'}
                        </p>
                    </div>

                    <div className='p-8 text-center'>
                        <p className='mb-8 text-gray-600'>
                            {paymentStatus === 'pending'
                                ? 'Te notificaremos cuando se confirme el pago.'
                                : 'Por favor intenta nuevamente o contactanos.'}
                        </p>

                        <div className='space-y-4'>
                            <a
                                href='/'
                                className='inline-block w-full px-8 py-3 font-semibold text-white rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                            >
                                Volver al inicio
                            </a>
                            <a
                                href='https://wa.me/1234567890'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-block w-full px-8 py-3 font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600'
                            >
                                Contactar por WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
