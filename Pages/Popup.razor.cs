using AngleSharp.Html;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace SoundPitchExtension.Pages;
public partial class Popup
{
    private int currentTheme = 1;
    private int c = 0;
    private double volume = 1;
    private double speed = 1;
    private double reverb = 0;

    private int verror = 0;
    private int serror = 0;
    private int rerror = 0;

    private int currentReverbOption = 1;
    private string cov = "";
    private string stu = "";
    private string sta = "";

    private bool preserverPitch = true;
    private string pitch = "";

    protected override void OnInitialized()
    {
        JSRuntime.InvokeAsync<Settings>("start");
    }

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            var settings = await JSRuntime.InvokeAsync<Settings>("loadSettings");
            volume = settings.Volume;
            speed = settings.Speed;
            reverb = settings.Reverb;
            currentReverbOption = settings.ReverbOption;
            preserverPitch = settings.preservePitch;

            StateHasChanged();


            verror = 0;
            var result1 = await JSRuntime.InvokeAsync<JsResult>("setVolume", volume);
            if (result1 == null || !result1.Success)
            {
                verror = 1;
            }
            else
            {
                verror = 2;
            }

            serror = 0;
            var result2 = await JSRuntime.InvokeAsync<JsResult>("setSpeed", speed);
            if (result2 == null || !result2.Success)
            {
                serror = 1;
            }
            else
            {
                serror = 2;
            }
            serror = 0;
            var result11 = await JSRuntime.InvokeAsync<JsResult>("setPitchPreservation", preserverPitch);
           
            if (result11 == null || !result11.Success)
            {
                serror = 1;
            }
            else
            {
                serror = 2;
            }
            pitch = preserverPitch == true ? "color: #88c900;border: solid 1px #88c900;" : "";
            rerror = 0;
            var result3 = await JSRuntime.InvokeAsync<JsResult>("setReverb", reverb);
            if (result3 == null || !result3.Success)
            {
                rerror = 1;
            }
            else
            {
                rerror = 2;
            }
            result1 = await JSRuntime.InvokeAsync<JsResult>("setReverbOption", currentReverbOption);
            result2 = await JSRuntime.InvokeAsync<JsResult>
                ("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
            if (result1 == null || result2 == null || !result1.Success || !result2.Success)
            {
                rerror = 1;
            }
            else
            {
                rerror = 2;
            }
            
            cov = currentReverbOption == 1 ? "color: #88c900;border: solid 1px #88c900;" : "";
            stu = currentReverbOption == 2 ? "color: #88c900;border: solid 1px #88c900;" : "";
            sta = currentReverbOption == 3 ? "color: #88c900;border: solid 1px #88c900;" : "";
            StateHasChanged();

        }
    }

    private async Task OnVolumeChange(ChangeEventArgs e)
    {
        volume = double.Parse(e.Value.ToString());
        verror = 0;
        var result1 = await JSRuntime.InvokeAsync<JsResult>("setVolume", volume);
        var result2 = await JSRuntime.InvokeAsync<JsResult>
            ("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        if (result1 == null || result2 == null || !result1.Success || !result2.Success)
        {
            verror = 1;
        }
        else
        {
            verror = 2;
        }

        StateHasChanged();
    }

    private async Task OnSpeedChange(ChangeEventArgs e)
    {
        speed = double.Parse(e.Value.ToString());
        serror = 0;
        var result1 = await JSRuntime.InvokeAsync<JsResult>("setSpeed", speed);
        var result2 = await JSRuntime.InvokeAsync<JsResult>("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        if (result1 == null || result2 == null || !result1.Success || !result2.Success)
        {
            serror = 1;
        }
        else
        {
            serror = 2;
        }
        StateHasChanged();
    }

    private async Task OnReverbChange(ChangeEventArgs e)
    {
        reverb = double.Parse(e.Value.ToString());
        rerror = 0;
        var result1 = await JSRuntime.InvokeAsync<JsResult>("setReverb", reverb);
        var result2 = await JSRuntime.InvokeAsync<JsResult>("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        if (result1 == null || result2 == null || !result1.Success || !result2.Success)
        {
            rerror = 1;
        }
        else
        {
            rerror = 2;
        }
        StateHasChanged();
    }

    public class Settings
    {
        public double Volume { get; set; }
        public double Speed { get; set; }
        public double Reverb { get; set; }
        public int ReverbOption { get; set; }
        public bool preservePitch { get; set; } = true;
    }

    public class JsResult
    {
        public bool Success { get; set; }
        public string Error { get; set; }
    }

    public void ChangeTheme(int i)
    {
        //currentTheme = i;
    }

    public async Task resetAllSettings()
    {
        verror = 0;
        var result1 = await JSRuntime.InvokeAsync<JsResult>("setVolume", 1.0);
        var result2 = await JSRuntime.InvokeAsync<JsResult>("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        if (result1 == null || result2 == null || !result1.Success || !result2.Success)
        {
            verror = 1;
        }
        else
        {
            verror = 2;
            volume = 1.0;
        }
        serror = 0;
        result1 = await JSRuntime.InvokeAsync<JsResult>("setSpeed", 1.0, true);
        result2 = await JSRuntime.InvokeAsync<JsResult>("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        if (result1 == null || result2 == null || !result1.Success || !result2.Success)
        {
            serror = 1;
        }
        else
        {
            serror = 2;
            speed = 1.0;
        }
        serror = 0;
        var result11 = await JSRuntime.InvokeAsync<JsResult>("setPitchPreservation", true);
        var result22 = await JSRuntime.InvokeAsync<JsResult>
            ("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        if (result11 == null || result22 == null || !result11.Success || !result22.Success)
        {
            serror = 1;
        }
        else
        {
            serror = 2;
        }
        preserverPitch = true;
        pitch = preserverPitch == true ? "color: #88c900;border: solid 1px #88c900;" : "";


        result1 = await JSRuntime.InvokeAsync<JsResult>("setReverb", 0.0);
        result2 = await JSRuntime.InvokeAsync<JsResult>("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        if (result1 == null || result2 == null || !result1.Success || !result2.Success)
        {
            rerror = 1;
        }
        else
        {
            rerror = 2;
            reverb = 0.0;
        }

        StateHasChanged();
    }

    public async Task setReverbOption(int option)
    {
        currentReverbOption = option;
        var result1 = await JSRuntime.InvokeAsync<JsResult>("setReverbOption", currentReverbOption);
        var result2 = await JSRuntime.InvokeAsync<JsResult>
            ("saveSettings", volume, speed, reverb, currentReverbOption);
        if (result1 == null || result2 == null || !result1.Success || !result2.Success)
        {
            rerror = 1;
        }
        else
        {
            rerror = 2;
        }
        cov = currentReverbOption == 1 ? "color: #88c900;border: solid 1px #88c900;" : "";
        stu = currentReverbOption == 2 ? "color: #88c900;border: solid 1px #88c900;" : "";
        sta = currentReverbOption == 3 ? "color: #88c900;border: solid 1px #88c900;" : "";

        StateHasChanged();
    }

    public async Task PreservePitch()
    {
        preserverPitch = preserverPitch == true ? false : true;
        var result1 = await JSRuntime.InvokeAsync<JsResult>("setPitchPreservation", preserverPitch);
        var result2 = await JSRuntime.InvokeAsync<JsResult>
            ("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        if (result1 == null || result2 == null || !result1.Success || !result2.Success)
        {
            serror = 1;
        }
        else
        {
            serror = 2;
        }

        pitch = preserverPitch == true ? "color: #88c900;border: solid 1px #88c900;" : "";

        StateHasChanged();
    }
}