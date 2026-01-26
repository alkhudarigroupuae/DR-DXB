import tkinter as tk
from tkinter import ttk, messagebox
import generator
import time
import random

class CardApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Syria Pay - Professional Card Generator")
        self.root.geometry("800x600")
        
        # Style
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # Create Tabs
        self.tab_control = ttk.Notebook(root)
        
        self.tab1 = ttk.Frame(self.tab_control)
        self.tab2 = ttk.Frame(self.tab_control)
        self.tab3 = ttk.Frame(self.tab_control)
        
        self.tab_control.add(self.tab1, text='Generation (توليد)')
        self.tab_control.add(self.tab2, text='Active Cards (بطاقات نشطة)')
        self.tab_control.add(self.tab3, text='Checker (فحص)')
        
        self.tab_control.pack(expand=1, fill="both")
        
        self.generated_cards = []
        
        self.setup_tab1()
        self.setup_tab2()
        self.setup_tab3()

    def setup_tab1(self):
        # Frame for inputs
        frame = ttk.LabelFrame(self.tab1, text="Card Configuration")
        frame.pack(pady=20, padx=20, fill="both")
        
        # BIN/Prefix Input
        ttk.Label(frame, text="BIN / First Digits (6-12 digits):").grid(row=0, column=0, padx=10, pady=10)
        self.bin_entry = ttk.Entry(frame, width=30)
        self.bin_entry.insert(0, "424242") # Default
        self.bin_entry.grid(row=0, column=1, padx=10, pady=10)
        
        # Quantity
        ttk.Label(frame, text="Quantity:").grid(row=1, column=0, padx=10, pady=10)
        self.qty_entry = ttk.Entry(frame, width=10)
        self.qty_entry.insert(0, "10")
        self.qty_entry.grid(row=1, column=1, padx=10, pady=10, sticky="w")
        
        # Generate Button
        btn_gen = ttk.Button(frame, text="Generate Cards", command=self.generate_cards_action)
        btn_gen.grid(row=2, column=0, columnspan=2, pady=20)
        
        # Output Area
        self.output_text = tk.Text(self.tab1, height=15, width=80)
        self.output_text.pack(pady=10, padx=20)
        
    def setup_tab2(self):
        ttk.Label(self.tab2, text="Active Cards (Simulation)", font=("Arial", 14)).pack(pady=10)
        
        self.active_tree = ttk.Treeview(self.tab2, columns=('Card', 'Exp', 'CVV', 'Status'), show='headings')
        self.active_tree.heading('Card', text='Card Number')
        self.active_tree.heading('Exp', text='Expiry')
        self.active_tree.heading('CVV', text='CVV')
        self.active_tree.heading('Status', text='Status')
        
        self.active_tree.pack(expand=True, fill='both', padx=20, pady=10)
        
        btn_refresh = ttk.Button(self.tab2, text="Load Active Cards (API Mock)", command=self.load_active_cards)
        btn_refresh.pack(pady=10)
        
    def setup_tab3(self):
        ttk.Label(self.tab3, text="Card Checker (Stripe Setup Intent / Auth)", font=("Arial", 14)).pack(pady=10)
        
        frame = ttk.Frame(self.tab3)
        frame.pack(fill='x', padx=20)
        
        # Stripe API Configuration (Mock)
        config_frame = ttk.LabelFrame(frame, text="Stripe Configuration")
        config_frame.pack(fill='x', pady=5)
        
        ttk.Label(config_frame, text="Secret Key (sk_live_...):").grid(row=0, column=0, padx=5, pady=5)
        self.stripe_key = ttk.Entry(config_frame, width=40)
        self.stripe_key.insert(0, "sk_live_simulation_key_...")
        self.stripe_key.grid(row=0, column=1, padx=5, pady=5)
        
        ttk.Label(frame, text="Input Format: Card|Exp|CVV").pack(anchor='w', pady=(10,0))
        self.check_input = tk.Text(frame, height=5, width=80)
        self.check_input.pack(pady=5)
        
        btn_check = ttk.Button(self.tab3, text="Start Setup Intent Check", command=self.start_checking)
        btn_check.pack(pady=10)
        
        self.check_log = tk.Text(self.tab3, height=15, width=80, state='disabled')
        self.check_log.pack(pady=10, padx=20)

    def log_check(self, message):
        self.check_log.config(state='normal')
        self.check_log.insert('end', message + "\n")
        self.check_log.see('end')
        self.check_log.config(state='disabled')
        self.root.update()

    def generate_cards_action(self):
        prefix = self.bin_entry.get().strip()
        try:
            qty = int(self.qty_entry.get())
        except ValueError:
            messagebox.showerror("Error", "Quantity must be a number")
            return
            
        if not prefix.isdigit():
            messagebox.showerror("Error", "BIN must be digits only")
            return
            
        self.output_text.delete(1.0, tk.END)
        self.generated_cards = []
        
        for _ in range(qty):
            card_num = generator.generate_card(prefix)
            exp = generator.generate_expiry()
            cvv = generator.generate_cvv()
            full_line = f"{card_num}|{exp}|{cvv}"
            self.generated_cards.append(full_line)
            self.output_text.insert(tk.END, full_line + "\n")
            
        messagebox.showinfo("Success", f"Generated {qty} cards successfully!")

    def load_active_cards(self):
        # Mocking API call to get "Active" cards
        # In a real app, this would fetch from a database or API
        for i in self.active_tree.get_children():
            self.active_tree.delete(i)
            
        if not self.generated_cards:
            # Generate some if none exist
            self.generated_cards = [f"{generator.generate_card('424242')}|12/28|123" for _ in range(5)]
            
        for card_data in self.generated_cards:
            parts = card_data.split('|')
            if len(parts) == 3:
                # Randomly assign status for simulation
                status = random.choice(["Active", "Active", "Requires 2FA"])
                self.active_tree.insert('', 'end', values=(parts[0], parts[1], parts[2], status))

    def start_checking(self):
        raw_data = self.check_input.get(1.0, tk.END).strip()
        lines = raw_data.split('\n')
        
        if not raw_data:
            # Use generated cards if input empty
            lines = self.generated_cards
            
        self.check_log.config(state='normal')
        self.check_log.delete(1.0, tk.END)
        self.check_log.config(state='disabled')
        
        for line in lines:
            line = line.strip()
            if not line: continue
            
            self.log_check(f"Checking {line}...")
            time.sleep(0.5) # Simulate network delay
            
            # Simulation Logic for Stripe Setup Intent
            # Real logic would use: stripe.SetupIntent.create(...)
            
            outcome = random.random()
            
            # Possible Stripe Decline Codes
            decline_reasons = [
                "generic_decline", 
                "insufficient_funds", 
                "lost_card", 
                "stolen_card", 
                "expired_card", 
                "incorrect_cvc", 
                "card_velocity_exceeded"
            ]
            
            if outcome > 0.6: # 40% chance of success in this simulation
                self.log_check(f"[LIVE] {line} - SetupIntent Succeeded (Card Saved & Verified)")
            else:
                reason = random.choice(decline_reasons)
                self.log_check(f"[DIE] {line} - Declined: {reason}")

if __name__ == "__main__":
    root = tk.Tk()
    app = CardApp(root)
    root.mainloop()
