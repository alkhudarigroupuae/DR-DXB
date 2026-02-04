import os
import stripe
import sys

# ==========================================
# Syria Pay - Stripe Integration (Backend)
# ==========================================

# Configure your Stripe Secret Key from environment variable `STRIPE_SECRET_KEY`
# For testing, set STRIPE_SECRET_KEY to sk_test_... in your environment
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_...") 

# Helper to verify incoming webhook signatures when using `stripe listen`
def verify_webhook(payload, sig_header, endpoint_secret):
    """
    Verifies a Stripe webhook payload using `endpoint_secret`.
    Returns the constructed event on success, or raises stripe.error.SignatureVerificationError.
    Usage:
      event = verify_webhook(request.data, request.headers.get('Stripe-Signature'), endpoint_secret)
    """
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
        return event
    except Exception:
        raise

def create_customer(email, name, phone=None):
    """
    Creates a Customer object in Stripe.
    This is the first step to saving a card.
    """
    try:
        customer = stripe.Customer.create(
            email=email,
            name=name,
            phone=phone,
            description="Syria Pay Client"
        )
        print(f"[Success] Customer created: {customer.id}")
        return customer
    except stripe.error.StripeError as e:
        print(f"[Error] Failed to create customer: {e.user_message}")
        return None

def create_setup_intent(customer_id):
    """
    Creates a SetupIntent to save a card for future use without charging it immediately.
    This is the recommended way by Stripe for "Active Card Checks".
    """
    try:
        intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
            usage="off_session", # Allows you to charge the card later when customer is offline
        )
        print(f"[Success] SetupIntent created: {intent.id}")
        print(f"Client Secret: {intent.client_secret}")
        return intent
    except stripe.error.StripeError as e:
        print(f"[Error] SetupIntent failed: {e.user_message}")
        return None

def confirm_setup_intent_server_side(setup_intent_id, payment_method_id):
    """
    (Optional) Confirm the SetupIntent on the server side if you have the PaymentMethod ID.
    Usually, confirmation happens on the Client Side (Frontend/App) using stripe.js.
    """
    try:
        intent = stripe.SetupIntent.confirm(
            setup_intent_id,
            payment_method=payment_method_id,
        )
        
        if intent.status == 'succeeded':
            print(f"[Active] Card is Valid and Saved! Intent ID: {intent.id}")
            return True
        elif intent.status == 'requires_action':
            print(f"[Warning] Card requires 3D Secure authentication.")
            return False
        else:
            print(f"[Failed] Card validation failed. Status: {intent.status}")
            return False
            
    except stripe.error.CardError as e:
        # Since it's a decline, card_error will be caught
        print(f"[Decline] Code: {e.code}, Message: {e.user_message}")
        return False
    except stripe.error.StripeError as e:
        print(f"[Error] API Error: {e.user_message}")
        return False

def list_active_payment_methods(customer_id):
    """
    List all valid, active cards saved for a customer.
    """
    try:
        cards = stripe.PaymentMethod.list(
            customer=customer_id,
            type="card",
        )
        print(f"\n--- Active Cards for {customer_id} ---")
        for card in cards.data:
            print(f"Card: **** **** **** {card.card.last4} | Exp: {card.card.exp_month}/{card.card.exp_year} | Brand: {card.card.brand}")
        return cards.data
    except stripe.error.StripeError as e:
        print(f"Error listing cards: {e}")
        return []

if __name__ == "__main__":
    print("--- Syria Pay Stripe Backend Integration ---")
    print("This script provides the functions needed to save and validate cards using Stripe Setup Intents.")
    print("To use this, you need to install the stripe library: 'pip install stripe'")
