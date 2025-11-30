import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSecretTrigger } from "@/hooks/use-secret-trigger";
import { Delete } from "lucide-react";

interface CalculatorViewProps {
  onUnlock: () => void;
}

export function CalculatorView({ onUnlock }: CalculatorViewProps) {
  const trigger = useSecretTrigger(onUnlock);
  const [display, setDisplay] = useState("0");
  const [prevValue, setPrevValue] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleNum = (num: string) => {
    if (display === "0") {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    setPrevValue(display);
    setOperator(op);
    setDisplay("0");
  };

  const handleEqual = () => {
    if (!prevValue || !operator) return;
    const current = parseFloat(display);
    const prev = parseFloat(prevValue);
    let result = 0;
    
    switch(operator) {
      case '+': result = prev + current; break;
      case '-': result = prev - current; break;
      case '×': result = prev * current; break;
      case '÷': result = prev / current; break;
    }
    
    setDisplay(String(result));
    setPrevValue(null);
    setOperator(null);
  };

  const handleClear = () => {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
  };

  return (
    <div className="h-screen w-full bg-background text-foreground font-technical flex flex-col mode-calculator p-4 md:p-0 md:justify-center md:items-center">
      <div className="w-full max-w-sm bg-card md:rounded-3xl md:shadow-2xl overflow-hidden flex flex-col h-full md:h-[800px] border border-border">
        
        {/* Display Area */}
        <div className="flex-1 bg-black p-6 flex flex-col justify-end items-end relative">
          {/* History / Operator Hint */}
          <div className="text-muted-foreground text-xl mb-2 h-8 flex items-center gap-2">
            {prevValue} {operator}
          </div>
          
          {/* Main Display */}
          <div className="text-6xl md:text-7xl font-light tracking-tight text-white break-all text-right w-full">
             {display}
          </div>
        </div>

        {/* Keypad */}
        <div className="bg-card p-4 grid grid-cols-4 gap-3 md:gap-4 flex-1">
          <CalcButton onClick={handleClear} variant="accent" className="text-red-400">AC</CalcButton>
          <CalcButton onClick={() => setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0')} variant="accent"><Delete size={24}/></CalcButton>
          <CalcButton onClick={() => handleOperator('%')} variant="accent">%</CalcButton>
          <CalcButton onClick={() => handleOperator('÷')} variant="primary">÷</CalcButton>

          <CalcButton onClick={() => handleNum('7')}>7</CalcButton>
          <CalcButton onClick={() => handleNum('8')}>8</CalcButton>
          <CalcButton onClick={() => handleNum('9')}>9</CalcButton>
          <CalcButton onClick={() => handleOperator('×')} variant="primary">×</CalcButton>

          <CalcButton onClick={() => handleNum('4')}>4</CalcButton>
          <CalcButton onClick={() => handleNum('5')}>5</CalcButton>
          <CalcButton onClick={() => handleNum('6')}>6</CalcButton>
          <CalcButton onClick={() => handleOperator('-')} variant="primary">-</CalcButton>

          <CalcButton onClick={() => handleNum('1')}>1</CalcButton>
          <CalcButton onClick={() => handleNum('2')}>2</CalcButton>
          <CalcButton onClick={() => handleNum('3')}>3</CalcButton>
          <CalcButton onClick={() => handleOperator('+')} variant="primary">+</CalcButton>

          <CalcButton onClick={() => handleNum('0')} className="col-span-2 w-full">0</CalcButton>
          <CalcButton onClick={() => !display.includes('.') && handleNum('.')}>.</CalcButton>
          <CalcButton onClick={handleEqual} variant="primary">=</CalcButton>
        </div>

        {/* Hidden footer with secret trigger - tap version number 5 times */}
        <div className="bg-black/50 py-2 px-4 flex justify-between items-center text-[10px] text-white/20">
          <span>Scientific Calculator</span>
          <button 
            onClick={() => {
              setShowHistory(prev => {
                if (!prev) {
                  setTimeout(() => setShowHistory(false), 500);
                  return true;
                }
                trigger();
                return false;
              });
            }}
            className="cursor-default select-none"
          >
            v3.2.1
          </button>
        </div>
      </div>
    </div>
  );
}

function CalcButton({ 
  children, 
  onClick, 
  className, 
  variant = "default" 
}: { 
  children: React.ReactNode, 
  onClick: () => void, 
  className?: string,
  variant?: "default" | "primary" | "accent"
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-full w-full rounded-2xl text-2xl font-medium transition-all active:scale-95 flex items-center justify-center select-none min-h-[60px]",
        variant === "default" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "accent" && "bg-accent text-accent-foreground hover:bg-accent/80",
        className
      )}
    >
      {children}
    </button>
  );
}
