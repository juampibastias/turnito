export const appointmentSchema = {
    clientName: String,
    clientLastName: String,
    clientPhone: String,
    selectedZones: [
        {
            zoneName: String,
            price: Number,
            duration: Number,
        },
    ],
    appointmentDate: Date,
    timeSlot: {
        start: String,
        end: String,
    },
    totalPrice: Number,
    totalDuration: Number,
    paymentStatus: String, // 'pending', 'paid', 'failed'
    paymentId: String,
    status: String, // 'confirmed', 'cancelled', 'completed'
    createdAt: Date,
    updatedAt: Date,
};

export const availableDaySchema = {
    date: Date,
    isEnabled: Boolean,
    timeSlots: [
        {
            start: String,
            end: String,
            isAvailable: Boolean,
        },
    ],
    zones: [
        {
            name: String,
            price: Number,
            duration: Number, // en minutos
        },
    ],
    createdAt: Date,
    updatedAt: Date,
};
