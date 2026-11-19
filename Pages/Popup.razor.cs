using System.Globalization;
using AngleSharp.Html;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace SoundPitchExtension.Pages;
public partial class Popup
{
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

    // false when the content script couldn't be injected/reached (restricted page, stale tab)
    private bool connected = true;
    private bool showReconnect => !connected || verror == 1 || serror == 1 || rerror == 1;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            await JSRuntime.InvokeVoidAsync("scope.start");
            await ConnectAndApply();
        }
    }

    // Injects the content script, then pushes the saved settings to the page.
    private async Task ConnectAndApply()
    {
        // Inject the content script and wait for it before sending any settings.
        var injected = await JSRuntime.InvokeAsync<JsResult>("start");
        connected = injected != null && injected.Success;
        if (connected) await JSRuntime.InvokeVoidAsync("scope.listen");

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

    // ---- view helpers ----
    private static readonly CultureInfo Ci = CultureInfo.InvariantCulture;
    private static string Inv(double d) => d.ToString("0.####", Ci);
    private static double Pct(double v, double min, double max) => Math.Clamp((v - min) / (max - min), 0, 1);
    // Status shown on each control's icon: red when it failed or the tab isn't reachable.
    private string Status(int status) => !connected || status == 1 ? "err" : status == 2 ? "ok" : "wait";

    private static IEnumerable<(int, double)> Steps(double min, double max, double step)
    {
        int n = (int)Math.Round((max - min) / step);
        for (int i = 0; i <= n; i++) yield return (i, Math.Round(min + i * step, 4));
    }

    // Lit ticks run from `from` to the current value (bipolar around 1x for speed).
    private static string TickClass(int i, double t, double value, double from, double? home)
    {
        var cls = i % 5 == 0 ? "major" : "";
        if (home is double h && Math.Abs(t - h) < 1e-6) cls += " home";
        double lo = Math.Min(from, value), hi = Math.Max(from, value);
        if (value != from && t >= lo - 1e-6 && t <= hi + 1e-6) cls += " lit";
        return cls;
    }

    public async Task resetAllSettings()
    {
        // Update local state first so the values we save are the reset ones.
        volume = 1.0;
        speed = 1.0;
        reverb = 0.0;
        preserverPitch = true;
        pitch = "color: #88c900;border: solid 1px #88c900;";

        var v = await JSRuntime.InvokeAsync<JsResult>("setVolume", volume);
        var s1 = await JSRuntime.InvokeAsync<JsResult>("setSpeed", speed);
        var p = await JSRuntime.InvokeAsync<JsResult>("setPitchPreservation", preserverPitch);
        var r = await JSRuntime.InvokeAsync<JsResult>("setReverb", reverb);
        var saved = await JSRuntime.InvokeAsync<JsResult>
            ("saveSettings", volume, speed, reverb, currentReverbOption, preserverPitch);
        bool ok(JsResult? x) => x != null && x.Success && saved != null && saved.Success;

        verror = ok(v) ? 2 : 1;
        serror = ok(s1) && ok(p) ? 2 : 1;
        rerror = ok(r) ? 2 : 1;

        StateHasChanged();
    }

    public async Task Reload()
    {
        await JSRuntime.InvokeVoidAsync("reload");
        await ConnectAndApply();
    }

    public async Task setReverbOption(int option)
    {
        currentReverbOption = option;
        var result1 = await JSRuntime.InvokeAsync<JsResult>("setReverbOption", currentReverbOption);
        var result2 = await JSRuntime.InvokeAsync<JsResult>
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