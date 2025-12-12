import React, { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Type } from 'lucide-react';
import { CustomFieldsManager } from './CustomFieldsManager';

interface CustomFieldsSheetProps {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    entityType?: 'contact' | 'deal';
}

export function CustomFieldsSheet({
    children,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    entityType = 'contact'
}: CustomFieldsSheetProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;



    return (
        <Sheet open={open} onOpenChange={setOpen}>
            {children && <SheetTrigger asChild>{children}</SheetTrigger>}
            <SheetContent className="sm:max-w-md w-full overflow-y-auto bg-zinc-950 border-l border-white/10 p-0 flex flex-col sm:w-[540px]">
                <SheetHeader className="p-6 border-b border-white/10">
                    <SheetTitle className="text-white flex items-center gap-2">
                        <div className="p-2 bg-primary-500/10 rounded-lg text-primary-500">
                            <Type size={18} />
                        </div>
                        Gerenciar Campos
                    </SheetTitle>
                    <SheetDescription className="text-gray-400">
                        Crie campos para armazenar dados específicos dos seus contatos.
                    </SheetDescription>
                </SheetHeader>

                <CustomFieldsManager entityType={entityType} />
            </SheetContent>
        </Sheet>
    );
}
