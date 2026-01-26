import random

def calculate_luhn_digit(number_str):
    """Calculates the Luhn check digit for a given string of numbers."""
    digits = [int(d) for d in number_str]
    # Reverse the digits to start from the right
    reversed_digits = digits[::-1]
    
    total_sum = 0
    for i, digit in enumerate(reversed_digits):
        if i % 2 == 0:
            # Multiply by 2 for digits at even indices (0, 2, 4...) in the reversed array
            # which corresponds to the odd positions from the right (excluding check digit position which we are calculating)
            # Actually standard Luhn: double every second digit from the right.
            # Since we are calculating the NEXT digit (the check digit), we treat the current last digit as the first from right (odd position).
            # So we multiply the ones at even indices of the *payload* reversed? 
            # Let's re-verify: 
            # Payload: 4 2 4 2
            # Append X: 4 2 4 2 X
            # Reverse: X 2 4 2 4
            # X is at index 0. 2 is at index 1.
            # Double every second digit from the right.
            # So we double indices 1, 3, 5... of the full number including check digit.
            # Since we don't have the check digit yet, let's assume we want to find X such that sum % 10 == 0.
            # In the reversed payload (without X):
            # Index 0 (original last) will be at position 2 from right (even) in the final number.
            # So we double the digits at even indices of the reversed payload.
            doubled = digit * 2
            if doubled > 9:
                doubled -= 9
            total_sum += doubled
        else:
            total_sum += digit
            
    # The check digit must make the total sum + check_digit divisible by 10.
    # Wait, the standard is: double every second digit from the rightmost.
    # If we append X, X is the 1st from right.
    # So the current last digit of payload is 2nd from right. It gets doubled.
    # The digit before that is 3rd (not doubled).
    # So in reversed payload: index 0 (was last) -> doubled. Index 1 -> not doubled.
    pass

def generate_luhn_check_digit(payload_str):
    """
    Generates the correct checksum digit for the payload using Luhn algorithm.
    Payload should be a string of digits (e.g., first 15 digits for a 16-digit card).
    """
    digits = [int(d) for d in payload_str]
    reversed_digits = digits[::-1]
    
    total_sum = 0
    for i, digit in enumerate(reversed_digits):
        # In the final number (payload + check), the check digit is at index 0 (reversed).
        # The last digit of payload is at index 1 (reversed).
        # Luhn doubles every second digit from the right.
        # So in the final number: indices 1, 3, 5... are doubled.
        # In our reversed_digits of payload, these correspond to indices 0, 2, 4...
        
        if i % 2 == 0: # 0, 2, 4... which are 2nd, 4th, 6th... from right in final number
            doubled = digit * 2
            if doubled > 9:
                doubled -= 9
            total_sum += doubled
        else:
            total_sum += digit
            
    remainder = total_sum % 10
    if remainder == 0:
        return 0
    else:
        return 10 - remainder

def generate_card(bin_or_prefix, length=16):
    """Generates a valid card number with the given prefix."""
    # Ensure prefix is string
    prefix = str(bin_or_prefix)
    
    if len(prefix) >= length:
        return prefix[:length] # Should verify luhn but user asked to generate
        
    # How many random digits we need? 
    # Length - PrefixLength - 1 (for check digit)
    random_digits_count = length - len(prefix) - 1
    
    random_digits = ""
    for _ in range(random_digits_count):
        random_digits += str(random.randint(0, 9))
        
    payload = prefix + random_digits
    check_digit = generate_luhn_check_digit(payload)
    
    return payload + str(check_digit)

def generate_expiry():
    """Generates a random future expiry date."""
    month = random.randint(1, 12)
    year = random.randint(2026, 2030) # Future years
    return f"{month:02d}/{year}"

def generate_cvv():
    """Generates a random 3-digit CVV."""
    return f"{random.randint(0, 999):03d}"
