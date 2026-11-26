package com.mrqvizt.habitlab;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.mrqvizt.habitlab.alarm.HabitAlarmPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HabitAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
