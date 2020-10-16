; This is an AutoHotkey (https://www.autohotkey.com) script that is intended
; to run on a computer that displays the Sofie prompter page.
; It automatically restores the focus to the Prompter-window if the focus
; is lost, so that the prompter controlling device (keyboard-equivalent /
; mouse-equivalent) continues to work.

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
