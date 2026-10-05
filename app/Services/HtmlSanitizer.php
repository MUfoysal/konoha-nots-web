<?php
declare(strict_types=1);

final class HtmlSanitizer
{
    public static function note(string $html): string
    {
        $document = new DOMDocument();
        libxml_use_internal_errors(true);
        $document->loadHTML('<!doctype html><html><body><div id="root">'.$html.'</div></body></html>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        $allowed=['a','b','blockquote','br','code','div','em','h1','h2','h3','hr','i','li','ol','p','pre','span','strong','u','ul'];
        foreach (iterator_to_array($document->getElementsByTagName('*')) as $element) {
            if (!in_array(strtolower($element->tagName), $allowed, true)) { $element->parentNode?->replaceChild($document->createTextNode($element->textContent), $element); continue; }
            foreach (iterator_to_array($element->attributes) as $attribute) {
                if (strtolower($element->tagName)==='a' && in_array(strtolower($attribute->name), ['href','target','rel'], true)) continue;
                $element->removeAttribute($attribute->name);
            }
            if (strtolower($element->tagName)==='a') { $href=$element->getAttribute('href'); if(!preg_match('#^(https?://|mailto:)#i',$href)) $element->removeAttribute('href'); else {$element->setAttribute('target','_blank');$element->setAttribute('rel','noopener noreferrer');} }
        }
        $root=$document->getElementById('root'); $result=''; foreach($root?->childNodes ?? [] as $child)$result.=$document->saveHTML($child); return $result;
    }
}
