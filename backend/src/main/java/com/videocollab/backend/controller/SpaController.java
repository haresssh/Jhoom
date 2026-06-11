package com.videocollab.backend.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaController {

    @RequestMapping(value = {
        "/login",
        "/signup",
        "/room/{roomId}",
        "/left-meeting/{roomId}"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
