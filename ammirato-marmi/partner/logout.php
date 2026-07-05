<?php
/**
 * Ammirato Marmi - Portale Partner
 * logout.php
 */
require_once __DIR__ . '/config.php';
session_unset();
session_destroy();
redirect('login.php');
