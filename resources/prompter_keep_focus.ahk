#WinActivateForce
SetTitleMatchMode, 2

Loop
{
    If WinActive(Prompter - Sofie) = 0
    {
        WinActivate, Prompter - Sofie
    }
    Sleep, 1000
}
