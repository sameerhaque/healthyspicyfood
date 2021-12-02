<script>
import Index from "./index.svelte";
import Error from "./__error.svelte";

</script>
<svelte:head>
    <link rel="stylesheet" href="../assets/css/bootstrap.css" />
</svelte:head>


<nav>
	<a href="/">Home</a>
	<a href="/about">About</a>
	<a href="/settings">Settings</a>
</nav>

<slot></slot>
