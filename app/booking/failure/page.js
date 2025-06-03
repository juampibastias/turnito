export default function Page() {
    return (
        <div className='min-h-screen px-4 py-12 bg-gradient-to-br from-red-50 to-orange-100'>
            <div className='max-w-2xl mx-auto'>
                <div className='overflow-hidden bg-white shadow-2xl rounded-3xl'>
                    <div className='p-8 text-center text-white bg-gradient-to-r from-red-500 to-orange-600'>
                        <div className='flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white rounded-full'>
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
                        <h1 className='mb-2 text-3xl font-bold'>
                            Pago No Procesado
                        </h1>
                        <p className='text-red-100'>
                            Hubo un problema con el pago
                        </p>
                    </div>

                    <div className='p-8 text-center'>
                        <p className='mb-8 text-gray-600'>
                            Tu reserva no se ha confirmado. Podés intentar de
                            nuevo o contactarnos por WhatsApp.
                        </p>

                        <div className='space-y-4'>
                            <a
                                href='/'
                                className='inline-block w-full px-8 py-3 font-semibold text-white rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                            >
                                Intentar nuevamente
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
