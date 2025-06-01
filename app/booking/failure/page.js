'use client';
import { useRouter } from 'next/router';

export default function BookingFailure() {
    const router = useRouter();

    return (
        <div className='min-h-screen bg-gradient-to-br from-red-50 to-orange-100 py-12 px-4'>
            <div className='max-w-2xl mx-auto'>
                <div className='bg-white rounded-3xl shadow-2xl overflow-hidden'>
                    <div className='bg-gradient-to-r from-red-500 to-orange-600 p-8 text-white text-center'>
                        <div className='w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4'>
                            <svg
                                className='w-8 h-8 text-red-500'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M6 18L18 6M6 6l12 12'
                                />
                            </svg>
                        </div>
                        <h1 className='text-3xl font-bold mb-2'>
                            Pago No Procesado
                        </h1>
                        <p className='text-red-100'>
                            Hubo un problema con el procesamiento del pago
                        </p>
                    </div>

                    <div className='p-8 text-center'>
                        <p className='text-gray-600 mb-8'>
                            No te preocupes, tu reserva no se ha confirmado y no
                            se ha realizado ningún cargo. Puedes intentar
                            nuevamente o contactarnos para asistencia.
                        </p>

                        <div className='space-y-4'>
                            <button
                                onClick={() => router.push('/')}
                                className='w-full px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 font-semibold'
                            >
                                Intentar nuevamente
                            </button>
                            <button
                                onClick={() =>
                                    window.open(
                                        'https://wa.me/1234567890',
                                        '_blank'
                                    )
                                }
                                className='w-full px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold'
                            >
                                Contactar por WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
