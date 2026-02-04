# Syria Pay - Card Generator & Stripe Integration

تطبيق متكامل لتوليد وفحص بطاقات الدفع مع تكامل Stripe الحقيقي.

## المتطلبات

قبل البدء، تأكد من تثبيت:
- **Node.js** (v14 أو أحدث) - [تحميل](https://nodejs.org/)
- **Python** (v3.8 أو أحدث) - [تحميل](https://www.python.org/)
- **Stripe CLI** (للاختبار مع webhooks) - [تحميل](https://stripe.com/docs/stripe-cli)

## التثبيت

### 1. تثبيت Node.js Dependencies

```bash
npm install
```

### 2. تثبيت Python Dependencies

```bash
cd python_card_app
pip install -r requirements.txt
cd ..
```

## الإعداد

### متغيرات البيئة

أنشئ ملف `.env` في جذر المشروع:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Server Port
PORT=8081
```

**للحصول على مفاتيح Stripe:**
1. سجل الدخول إلى [Stripe Dashboard](https://dashboard.stripe.com/)
2. انتقل إلى "Developers" → "API keys"
3. انسخ "Secret Key" (ابدأ بـ `sk_test_`)

## التشغيل

### الطريقة الأولى: شغل السرفر مع Stripe CLI (مع webhooks)

**Terminal 1 - شغل السرفر:**
```bash
node server.js
```

**Terminal 2 - شغل Stripe CLI للاستماع للـ webhooks:**
```bash
stripe listen --forward-to localhost:8081/webhook
```

ستحصل على `Webhook Signing Secret` - أضفه في ملف `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Terminal 3 - شغل تطبيق Python (اختياري):**
```bash
cd python_card_app
python main.py
```

### الطريقة الثانية: شغل السرفر فقط (بدون webhooks)

```bash
node server.js
```

ثم افتح المتصفح على:
```
http://localhost:8081
```

## الاستخدام

### تطبيق الويب
- توليد بطاقات اختبار
- فحص البطاقات مع Stripe Setup Intent
- عرض معلومات البطاقة والحالة

### تطبيق Python (GUI)
- توليد بطاقات سريع
- محاكاة فحص البطاقات
- عرض البطاقات النشطة

## API Endpoints

| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/check-card` | POST | فحص بطاقة مع Stripe |
| `/api/verify-stripe` | POST | التحقق من صحة مفتاح Stripe |
| `/api/lookup/:bin` | GET | البحث عن معلومات BIN |
| `/webhook` | POST | استقبال أحداث Stripe |

## أنماط الاختبار

استخدم بطاقات الاختبار هذه:

| الحالة | رقم البطاقة | CVC | التاريخ |
|--------|-----------|-----|--------|
| نجح | 4242 4242 4242 4242 | أي 3 أرقام | أي تاريخ مستقبلي |
| رفض عام | 4000 0000 0000 0002 | أي 3 أرقام | أي تاريخ مستقبلي |
| نقص رصيد | 4000 0000 0000 9995 | أي 3 أرقام | أي تاريخ مستقبلي |

## استكشاف الأخطاء

### Node.js غير مثبت
```bash
# على Windows
https://nodejs.org/
# ثم أعد تشغيل PowerShell/CMD
```

### Python غير متوفر
```bash
# على Windows
https://www.python.org/
# اختر "Add Python to PATH" أثناء التثبيت
```

### مفتاح Stripe غير صحيح
- تأكد من المفتاح يبدأ بـ `sk_test_` أو `sk_live_`
- تحقق من الملف `.env`
- أعد تشغيل السرفر بعد التعديل

### محفظة Stripe غير متصلة
- تأكد من تشغيل `stripe listen` في terminal منفصل
- تحقق من رسالة `Webhook Signing Secret`

## الهيكل

```
z:/
├── server.js                 # Express server بـ Stripe API
├── package.json              # Node.js dependencies
├── .env                       # متغيرات البيئة (أنشئها بنفسك)
├── web_card_app/             # تطبيق الويب
│   ├── index.html
│   ├── manifest.json
│   └── service-worker.js
└── python_card_app/          # تطبيق Python GUI
    ├── main.py               # واجهة التطبيق (Tkinter)
    ├── generator.py          # توليد البيانات
    ├── real_stripe_integration.py  # تكامل Stripe
    └── requirements.txt      # Python dependencies
```

---

**تم الإنشاء:** يناير 2026
**الإصدار:** 1.0.0
